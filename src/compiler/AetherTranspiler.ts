import * as acorn from "acorn";
import { KernelID, VSO_REGISTRY, hashChannel } from "../types/Protocol";
import { forthService } from "../services/WaForthService";

// --- TYPES ---
interface ASTNode {
  type: string;
  [key: string]: any;
}

interface Scope {
  functionName: string;
  variables: Map<string, number>;
  args: Map<string, number>;
  frameSize: number;
  parent: Scope | null;
}

interface StructDef {
    name: string;
    fields: Map<string, number>; // FieldName -> ByteOffset
    size: number;
}

const KNOWN_VARIABLES = new Set([
  "M_OP", "M_SENDER", "M_TARGET", "M_P1", "M_P2", "M_P3",
  "OUT_PTR", "STR_PTR", "LAST_PLAYER_X", "LAST_PLAYER_Y"
]);

const KNOWN_CONSTANTS = new Set([
  "IN_COUNT", "OUT_COUNT",
  "INPUT_QUEUE", "OUTPUT_QUEUE", "INBOX", "OUTBOX",
  "STR_BUF_START", "STR_BUF_END", "TEMP_VSO_BUFFER",
  "REQ_MOVE", "REQ_TELEPORT", "REQ_TERRAIN", "REQ_PATH_STEP",
  "EVT_MOVED", "EVT_COLLIDE", "EVT_SPAWN", "EVT_DAMAGE", "EVT_DEATH", "EVT_ITEM_GET", "EVT_LEVEL_TRANSITION",
  "CMD_INTERACT", "CMD_SPEAK", "CMD_ATTACK", "CMD_KILL", "CMD_PICKUP",
  "SYS_LOG", "SYS_CHAN_SUB", "SYS_CHAN_UNSUB", "SYS_ERROR", "SYS_BLOB",
  "K_HOST", "K_GRID", "K_PLAYER", "K_HIVE", "K_BATTLE", "K_PLATFORM", "K_BUS"
]);

const KNOWN_GLOBALS = new Set([...KNOWN_VARIABLES, ...KNOWN_CONSTANTS]);

export class AetherTranspiler {
  private static output: string[] = [];
  private static jsLines: string[] = [];
  private static lastEmittedLine: number = -1;
  private static currentKernelId: number = 0;

  private static globalVars: Set<string> = new Set();
  private static globalConsts: Map<string, any> = new Map();
  private static globalFieldOffsets: Map<string, number> = new Map();
  private static structs: Map<string, StructDef> = new Map();
  private static localStructs: Set<string> = new Set();
  private static exportedArrays: Map<string, string> = new Map();
  private static structArrayCounts: Map<string, any> = new Map();
  private static varTypes: Map<string, string> = new Map();
  private static scopes: Scope[] = [];
  private static currentScope: Scope | null = null;
  private static loopVars: string[] = [];
  private static nextVsoTypeId: number = 100;

  private static channelSubscriptions: Map<number, any> = new Map();
  private static functionReturnTypes: Map<string, string> = new Map();
  public static globalExportRegistry: Map<string, any> = new Map();

  public static reset() {
      this.globalExportRegistry = new Map();
      this.nextVsoTypeId = 100;
      this.structs = new Map();
  }

  public static transpile(jsCode: string, kernelId: number = 0): string {
    this.output = [];
    this.jsLines = jsCode.split("\n");
    this.lastEmittedLine = -1;
    this.currentKernelId = kernelId;
    this.globalVars = new Set();
    this.globalConsts = new Map();
    this.globalFieldOffsets = new Map();
    this.structs = new Map();
    this.localStructs = new Set();
    this.exportedArrays = new Map();
    this.structArrayCounts = new Map();
    this.varTypes = new Map();
    this.scopes = [];
    this.currentScope = null;
    this.loopVars = [];
    this.channelSubscriptions = new Map();

    let processedCode = this.extractStructs(jsCode);
    processedCode = processedCode.replace(/<-\s*(\[[^\]]*\])/g, ".send($1)");

    try {
      const ast = acorn.parse(processedCode, { ecmaVersion: 2020, locations: true });
      this.emitStructs();
      this.analyzeScopes(ast as ASTNode, null);
      this.emitGlobals();
      this.compileNode(ast as ASTNode);
      this.emitSubscriptionWord();
      this.emit("AJS_INIT_CHANNELS");
      return this.output.join("\n");
    } catch (e: any) {
      console.error("Transpilation Failed:", e);
      return `( ERROR: ${e.message} )`;
    }
  }

  private static extractStructs(code: string): string {
      const structRegex = /struct\s+(\w+)\s*\{\s*([^}]+)\s*\}/g;
      const exportRegex = /export\s+(\w+);?/g;
      let match;
      let cleanCode = code;
      while ((match = structRegex.exec(code)) !== null) {
          const name = match[1];
          const fieldsStr = match[2];
          const fields = fieldsStr.split(',').map(s => s.trim()).filter(s => s);
          this.localStructs.add(name);
          const existing = this.structs.get(name);
          if (existing) {
              if (existing.fields.size !== fields.length) throw new Error(`Struct '${name}' re-defined with different number of fields.`);
              existing.fields.forEach((offset, f) => { this.globalFieldOffsets.set(f, offset); });
          } else {
              const def: StructDef = { name, fields: new Map(), size: fields.length * 4 };
              fields.forEach((f, i) => {
                  const offset = i * 4;
                  def.fields.set(f, offset);
                  this.globalFieldOffsets.set(f, offset);
              });
              this.structs.set(name, def);
          }
          cleanCode = cleanCode.replace(match[0], (m) => m.replace(/[^\n]/g, " "));
      }
      while ((match = exportRegex.exec(code)) !== null) {
          const varName = match[1];
          this.exportedArrays.set("__PENDING_" + varName, varName);
          cleanCode = cleanCode.replace(match[0], (m) => m.replace(/[^\n]/g, " "));
      }
      return cleanCode;
  }

  private static emitStructs() {
      if (this.structs.size === 0) return;
      this.emit("( --- STRUCT OFFSETS --- )");
      const emittedLegacy = new Set<string>();
      this.structs.forEach(def => {
          this.emit(`( Struct: ${def.name} )`);
          const structUpper = def.name.toUpperCase();
          const sSizeof = this.sanitizeName(`SIZEOF_${structUpper}`);
          this.emit(`${def.size} CONSTANT ${sSizeof}`);
          def.fields.forEach((offset, fieldName) => {
              const fieldUpper = fieldName.toUpperCase();
              const sOffPrefixed = this.sanitizeName(`OFF_${structUpper}_${fieldUpper}`);
              this.emit(`${offset} CONSTANT ${sOffPrefixed}`);
              if (this.localStructs.has(def.name)) {
                  const sOffLegacy = this.sanitizeName(`OFF_${fieldUpper}`);
                  if (!emittedLegacy.has(sOffLegacy)) {
                      this.emit(`${offset} CONSTANT ${sOffLegacy}`);
                      emittedLegacy.add(sOffLegacy);
                  }
              }
          });
      });
      this.emit("( --------------------- )");
  }

  private static analyzeScopes(node: ASTNode, currentScope: Scope | null = null) {
      if (node.type === "Program") {
          const programScope: Scope = {
              functionName: "PROGRAM",
              variables: new Map(),
              args: new Map(),
              frameSize: 0,
              parent: null
          };
          this.scopes.push(programScope);
          currentScope = programScope;
          node.body.forEach((n: any) => {
              if (n.type === "VariableDeclaration") {
                  n.declarations.forEach((decl: any) => {
                      const name = decl.id.name.toUpperCase();
                      if (decl.init && decl.init.type === "NewExpression" && decl.init.callee.name && (decl.init.callee.name.includes("Uint8") || decl.init.callee.name.includes("Uint32") || decl.init.callee.name.includes("Int32"))) {
                          this.varTypes.set(name, decl.init.callee.name);
                      } else if (decl.init && decl.init.type === "CallExpression" && decl.init.callee.name && (decl.init.callee.name === "Uint8Array" || decl.init.callee.name === "Uint32Array" || decl.init.callee.name === "Int32Array")) {
                          this.varTypes.set(name, decl.init.callee.name);
                      } else if (decl.init && decl.init.type === "NewExpression" && decl.init.callee.name === "Array") {
                          const firstArg = decl.init.arguments[0];
                          const secondArg = decl.init.arguments[1];
                          const thirdArg = decl.init.arguments[2];
                          if (firstArg && firstArg.type === "Identifier" && this.structs.has(firstArg.name)) {
                              this.varTypes.set(name, `struct ${firstArg.name}`);
                              if (secondArg) {
                                  if (secondArg.type === "Literal") {
                                      this.structArrayCounts.set(name, secondArg.value);
                                  } else if (secondArg.type === "Identifier") {
                                      this.structArrayCounts.set(name, secondArg.name.toUpperCase());
                                  }
                              }
                              if (thirdArg && thirdArg.type === "Literal") {
                                  this.globalConsts.set(name, thirdArg);
                              }
                          }
                      }
                      if (n.kind === "const") {
                          this.globalConsts.set(name, decl.init);
                      } else {
                          this.globalVars.add(name);
                      }
                  });
              }
          });

          const pending = Array.from(this.exportedArrays.keys()).filter(k => k.startsWith("__PENDING_"));
          pending.forEach(pk => {
              const varName = this.exportedArrays.get(pk)!;
              const structType = this.getStructType(varName);
              if (structType) {
                  const upperVarName = varName.toUpperCase();
                  this.exportedArrays.set(structType, upperVarName);
                  const structDef = this.structs.get(structType);
                  if (structDef) {
                      if (!AetherTranspiler.globalExportRegistry.has(structType)) {
                          let typeId = VSO_REGISTRY[structType.toUpperCase()]?.typeId || AetherTranspiler.nextVsoTypeId++;
                          AetherTranspiler.globalExportRegistry.set(structType, {
                              owner: this.currentKernelId,
                              varName: upperVarName,
                              typeId: typeId,
                              sizeBytes: structDef.size,
                              fields: structDef.fields
                          });
                      }
                  }
              }
              this.exportedArrays.delete(pk);
          });
      }

      if (node.type === "FunctionDeclaration") {
          const funcName = node.id.name.toUpperCase();
          const scope: Scope = {
              functionName: funcName,
              variables: new Map(),
              args: new Map(),
              frameSize: 0,
              parent: currentScope
          };
          node.params.forEach((p: any, i: number) => {
              scope.args.set(p.name.toUpperCase(), i * 4);
          });
          scope.frameSize = node.params.length * 4;
          this.scopes.push(scope);
          this.findVariables(node.body, scope);
          this.analyzeScopes(node.body, scope);
          return;
      }

      Object.keys(node).forEach(key => {
          const child = (node as any)[key];
          if (child && typeof child === "object") {
              if (Array.isArray(child)) {
                  child.forEach((c: any) => {
                      if (c && c.type) this.analyzeScopes(c, currentScope);
                  });
              } else if (child.type) {
                  this.analyzeScopes(child, currentScope);
              }
          }
      });
  }

  private static findVariables(node: ASTNode, scope: Scope) {
    if (!node) return;
    if (node.type === "VariableDeclaration") {
      node.declarations.forEach((decl: any) => {
        const name = decl.id.name.toUpperCase();
        if (!scope.args.has(name) && !scope.variables.has(name)) {
            scope.variables.set(name, scope.frameSize);
            scope.frameSize += 4;
        }
      });
    }
    Object.keys(node).forEach(key => {
        const child = (node as any)[key];
        if (typeof child === 'object' && child !== null) {
            if (Array.isArray(child)) {
                child.forEach(c => this.findVariables(c, scope));
            } else if (child.type) {
                this.findVariables(child, scope);
            }
        }
    });
  }

  private static emitGlobals() {
    this.emit("( --- AETHER AUTO-GLOBALS --- )");
    this.emit("( --- AETHER LOCAL STACK --- )");
    this.emit("VARIABLE LP");
    this.emit("VARIABLE FP");
    this.emit("VARIABLE FSP");
    this.emit("CREATE LOCAL_STACK 1048576 ALLOT");
    this.emit("CREATE FRAME_STACK 1024 CELLS ALLOT");
    this.emit("LOCAL_STACK LP !");
    this.emit("LOCAL_STACK FP !");
    this.emit("FRAME_STACK FSP !");
    this.emit("");
    this.emit(": LOCAL_VARS ( offset -- addr ) FP @ + ;");
    this.emit("");
    this.emit(": ENTER_FRAME ( size -- )");
    this.emit("  FP @  FSP @ !  4 FSP +! ");
    this.emit("  LP @  FSP @ !  4 FSP +! ");
    this.emit("  LP @  FP ! ");
    this.emit("  LP +! ");
    this.emit(";");
    this.emit("");
    this.emit(": LEAVE_FRAME ( -- )");
    this.emit("  -4 FSP +!  FSP @ @ LP ! ");
    this.emit("  -4 FSP +!  FSP @ @ FP ! ");
    this.emit(";");
    this.emit("VARIABLE CHANNELS_INITED");
    this.emit("0 CHANNELS_INITED !");
    this.globalConsts.forEach((init, name) => {
      if (this.isStructArray(name)) return;
      const sv = this.sanitizeName(name);
      let val = 0;
      if (init) {
          if (init.type === "Literal") val = init.value;
          else if (init.type === "Identifier") {
              const constInit = this.globalConsts.get(init.name.toUpperCase());
              if (constInit && constInit.type === "Literal") val = constInit.value;
          } else if (init.type === "NewExpression" || init.type === "CallExpression") {
              if (init.arguments && init.arguments.length > 0) {
                  const arg0 = init.arguments[0];
                  if (arg0.type === "Literal") val = arg0.value;
                  else if (arg0.type === "Identifier") {
                      const constInit = this.globalConsts.get(arg0.name.toUpperCase());
                      if (constInit && constInit.type === "Literal") val = constInit.value;
                  }
              }
          }
      }
      this.emit(`${val} CONSTANT ${sv}`);
    });
    this.globalVars.forEach(v => {
      if (KNOWN_GLOBALS.has(v)) return;
      const sv = this.sanitizeName(v);
      if (this.isStructArray(v)) {
          const structName = this.getStructType(v);
          const count = this.structArrayCounts.get(this.getMetadataName(v)) || 0;
          const constInit = this.globalConsts.get(v);
          if (constInit && constInit.type === "Literal" && typeof constInit.value === "number") {
               this.emit(`${constInit.value} CONSTANT ${sv}`);
          } else {
               this.emit(`CREATE ${sv} ${count} SIZEOF_${structName?.toUpperCase()} * ALLOT`);
          }
          const entry = AetherTranspiler.globalExportRegistry.get(structName!);
          if (entry && entry.owner === this.currentKernelId && entry.varName === v) {
              this.emit(`${sv} ${entry.typeId} ${entry.sizeBytes} JS_REGISTER_VSO`);
          }
      } else {
          this.emit(`VARIABLE ${sv}`);
      }
    });
    this.globalConsts.forEach((init, name) => {
        if (!this.isStructArray(name)) return;
        if (this.globalVars.has(name)) return;
        const sv = this.sanitizeName(name);
        const structName = this.getStructType(name);
        const count = this.structArrayCounts.get(this.getMetadataName(name)) || 0;
        if (init && init.type === "Literal" && typeof init.value === "number") {
             this.emit(`${init.value} CONSTANT ${sv}`);
        } else {
             this.emit(`CREATE ${sv} ${count} SIZEOF_${structName?.toUpperCase()} * ALLOT`);
        }
        const entry = AetherTranspiler.globalExportRegistry.get(structName!);
        if (entry && entry.owner === this.currentKernelId && entry.varName === name) {
            this.emit(`${sv} ${entry.typeId} ${entry.sizeBytes} JS_REGISTER_VSO`);
        }
    });
    this.exportedArrays.forEach((varName, structType) => {
        const sv = this.sanitizeName(varName);
        const ss = structType.toUpperCase();
        this.emit(`: ${this.sanitizeName(structType)} SIZEOF_${ss} * ${sv} + ;`);
    });
    this.emit("( ------------------------- )");
  }

  private static compileNode(node: ASTNode) {
    if (node.loc && this.jsLines.length > 0) {
        const startLine = node.loc.start.line - 1;
        if (startLine >= 0 && startLine < this.jsLines.length && startLine !== this.lastEmittedLine) {
            const line = this.jsLines[startLine].trim();
            if (line && !line.startsWith("//") && !line.startsWith("/*")) {
                this.emit(`\n( ${line} )`);
                this.lastEmittedLine = startLine;
            }
        }
    }
    switch (node.type) {
      case "Program":
        node.body.forEach((n: any) => this.compileNode(n));
        break;
      case "FunctionDeclaration":
        const name = node.id.name.toUpperCase();
        const forthName = this.sanitizeName(name);
        const scope = this.scopes.find(s => s.functionName === name);
        this.currentScope = scope || null;
        this.emit(`\n: ${forthName} `);
        this.emit(`  ( Function Entry: ${forthName} )`);
        this.emit(`  S" [AJS] Calling ${forthName}" JS_LOG`);
        if (scope) {
            this.emit(`  ${scope.frameSize} ENTER_FRAME`);
            if (scope.args.size > 0) {
                this.emit(`  ( Move Arguments to Frame )`);
                const argNames = Array.from(scope.args.keys()).reverse();
                argNames.forEach(name => {
                    const offset = scope.args.get(name);
                    this.emit(`  ${offset} LOCAL_VARS !`);
                });
            }
        }
        this.compileNode(node.body);
        if (name === "HANDLE_EVENTS") this.emitChannelHandlers();
        if (scope) this.emit(`  LEAVE_FRAME`);
        this.emit(`;`);
        this.currentScope = null;
        break;
      case "BlockStatement":
        node.body.forEach((n: any) => this.compileNode(n));
        break;
      case "VariableDeclaration":
        node.declarations.forEach((decl: any) => {
           if (decl.init) {
               const varName = this.resolveVar(decl.id.name);
               if (this.isStructArray(decl.id.name)) return;
               this.compileNode(decl.init);
               this.emit(`  ${varName} !`);
               const rhsType = this.inferType(decl.init);
               if (rhsType) this.varTypes.set(this.getMetadataName(decl.id.name), rhsType);
           }
        });
        break;
      case "ExpressionStatement":
        this.compileNode(node.expression);
        break;
      case "WhileStatement":
        this.emit(`  BEGIN`);
        this.compileNode(node.test);
        this.emit(`  WHILE`);
        this.compileNode(node.body);
        this.emit(`  REPEAT`);
        break;
      case "ForStatement":
        let isSupported = false;
        if (node.init && node.init.type === "VariableDeclaration" && node.init.declarations.length === 1) {
            const decl = node.init.declarations[0];
            const startVal = decl.init;
            const loopVarName = decl.id.name;
            if (node.test && node.test.type === "BinaryExpression" && node.test.operator === "<" && node.test.left.name === loopVarName) {
                 const endVal = node.test.right;
                 if (node.update && node.update.type === "UpdateExpression" && node.update.operator === "++" && node.update.argument.name === loopVarName) {
                     isSupported = true;
                     this.compileNode(endVal);
                     this.compileNode(startVal);
                     this.emit(`  DO`);
                     this.loopVars.push(loopVarName.toUpperCase());
                     this.compileNode(node.body);
                     this.loopVars.pop();
                     this.emit(`  LOOP`);
                 }
            }
        }
        if (!isSupported) this.emit(`  ( ERROR: Only simple 'for(let i=0; i<N; i++)' loops supported )`);
        break;
      case "LogicalExpression":
        this.compileNode(node.left);
        this.compileNode(node.right);
        if (node.operator === "&&") this.emit(`  AND`);
        else if (node.operator === "||") this.emit(`  OR`);
        break;
      case "UnaryExpression":
        this.compileNode(node.argument);
        if (node.operator === "!") this.emit(`  0=`);
        else if (node.operator === "-") this.emit(`  NEGATE`);
        else if (node.operator === "~") this.emit(`  INVERT`);
        break;
      case "UpdateExpression":
        if (node.argument.type === "Identifier") {
            const varName = this.resolveVar(node.argument.name);
            const val = node.operator === "++" ? "1" : "-1";
            this.emit(`  ${val} ${varName} +!`);
        } else if (node.argument.type === "MemberExpression" && !node.argument.computed) {
            const propName = node.argument.property.name;
            const structType = this.getExpressionStructType(node.argument.object);
            const offConst = structType ? `OFF_${structType.toUpperCase()}_${propName.toUpperCase()}` : `OFF_${propName.toUpperCase()}`;
            const val = node.operator === "++" ? "1" : "-1";
            this.emit(`  ${val}`);
            this.compileNode(node.argument.object);
            this.emit(`  ${offConst} + +!`);
        }
        break;
      case "AssignmentExpression":
        if (node.left.type === "MemberExpression" && node.left.object.type === "Identifier" && node.left.object.name === "MEM8") {
             this.compileNode(node.right);
             this.compileNode(node.left.property);
             this.emit(`  C!`);
        } else if (node.left.type === "MemberExpression" && node.left.object.type === "Identifier" && node.left.object.name === "MEM32") {
             this.compileNode(node.right);
             this.compileNode(node.left.property);
             this.emit(`  !`);
        } else if (node.left.type === "Identifier") {
            const varName = this.resolveVar(node.left.name);
            if (node.operator === "=") {
                this.compileNode(node.right);
                this.emit(`  ${varName} !`);
                const rhsType = this.inferType(node.right);
                if (rhsType) this.varTypes.set(this.getMetadataName(node.left.name), rhsType);
            } else if (node.operator === "+=") {
                this.compileNode(node.right);
                this.emit(`  ${varName} +!`);
            } else if (node.operator === "-=") {
                this.compileNode(node.right);
                this.emit(`  NEGATE ${varName} +!`);
            } else {
                this.compileNode(node.right);
                this.emit(`  ${varName} @ SWAP`);
                if (node.operator === "*=") this.emit(`  *`);
                if (node.operator === "/=") this.emit(`  /`);
                this.emit(`  ${varName} !`);
            }
        } else if (node.left.type === "MemberExpression" && !node.left.computed) {
            const propName = node.left.property.name;
            const structType = this.getExpressionStructType(node.left.object);
            const offConst = structType ? `OFF_${structType.toUpperCase()}_${propName.toUpperCase()}` : `OFF_${propName.toUpperCase()}`;
            const offset = structType ? this.structs.get(structType)?.fields.get(propName) : this.globalFieldOffsets.get(propName);
            if (offset !== undefined) {
                 if (node.operator === "=") {
                     this.compileNode(node.right);
                     this.compileNode(node.left.object);
                     this.emit(`  ${offConst} + !`);
                 } else if (node.operator === "+=") {
                     this.compileNode(node.right);
                     this.compileNode(node.left.object);
                     this.emit(`  ${offConst} + +!`);
                 } else if (node.operator === "-=") {
                     this.compileNode(node.right);
                     this.emit(`  NEGATE`); 
                     this.compileNode(node.left.object);
                     this.emit(`  ${offConst} + +!`);
                 }
            }
        } else if (node.left.type === "MemberExpression" && node.left.computed) {
            this.compileNode(node.right);
            this.compileNode(node.left.object);
            this.compileNode(node.left.property);
            const isByte = node.left.object.type === "Identifier" && this.isByteType(node.left.object.name);
            const structType = this.getExpressionStructType(node.left.object);
            if (node.operator === "=") {
                if (isByte) this.emit(`  + C!`);
                else if (structType) this.emit(`  SIZEOF_${structType.toUpperCase()} * + !`);
                else this.emit(`  CELLS + !`);
            } else if (node.operator === "+=") {
                if (isByte) this.emit(`  + DUP C@ ROT + SWAP C!`);
                else if (structType) this.emit(`  SIZEOF_${structType.toUpperCase()} * + +!`);
                else this.emit(`  CELLS + +!`);
            }
        }
        break;
      case "MemberExpression":
        if (node.object.type === "Identifier" && node.object.name === "MEM8") {
            this.compileNode(node.property);
            this.emit(`  C@`);
        } else if (node.object.type === "Identifier" && node.object.name === "MEM32") {
            this.compileNode(node.property);
            this.emit(`  @`);
        } else if (node.computed) {
            this.compileNode(node.object);
            this.compileNode(node.property);
            const isByte = node.object.type === "Identifier" && this.isByteType(node.object.name);
            const structType = this.getExpressionStructType(node.object);
            if (isByte) this.emit(`  + C@`);
            else if (structType) this.emit(`  SIZEOF_${structType.toUpperCase()} * +`);
            else this.emit(`  CELLS + @`);
        } else if (!node.computed) {
             const propName = node.property.name;
             const structType = this.getExpressionStructType(node.object);
             const offConst = structType ? `OFF_${structType.toUpperCase()}_${propName.toUpperCase()}` : `OFF_${propName.toUpperCase()}`;
             const offset = structType ? this.structs.get(structType)?.fields.get(propName) : this.globalFieldOffsets.get(propName);
             if (offset !== undefined) {
                 this.compileNode(node.object);
                 this.emit(`  ${offConst} + @`);
             }
        }
        break;
      case "CallExpression":
        if (node.callee.type === "Identifier") {
            const funcName = node.callee.name;
            const func = funcName.toUpperCase();
            if (func === "CHAN") {
                const arg = node.arguments[0];
                if (!arg) this.emit(`  ${this.currentKernelId} ( Self Channel )`);
                else if (arg.type === "Literal" && typeof arg.value === "string") {
                    const name = arg.value.toUpperCase();
                    if (KernelID[name] !== undefined) this.emit(`  ${KernelID[name]}`);
                    else {
                        this.emit(`  ${hashChannel(arg.value)}`);
                        forthService.registerChannel(arg.value);
                    }
                } else this.compileNode(arg);
                return;
            }
            if (func === "LOG") {
                const arg0 = node.arguments[0];
                if (arg0 && arg0.type === "Literal" && typeof arg0.value === "string") this.emit(`  S" ${arg0.value}" S.`);
                else { this.compileNode(arg0); this.emit(`  .N`); }
                return;
            }
            if (VSO_REGISTRY[func]) {
                this.compileNode(node.arguments[0]);
                const entry = VSO_REGISTRY[func];
                if (entry.owner === this.currentKernelId) this.emit(`  ${entry.sizeBytes} * ${entry.baseAddr} +`);
                else this.emit(`  VSO_${func} JS_SYNC_OBJECT`);
                return;
            }
            if (this.structs.has(funcName)) {
                this.compileNode(node.arguments[0]);
                this.emit(`  SIZEOF_${func} * ${this.sanitizeName(this.exportedArrays.get(funcName) || funcName)} +`);
                return;
            }
            node.arguments.forEach((arg: any) => this.compileNode(arg));
            const forthName = this.sanitizeName(func);
            this.emit(`  ${forthName}`);
        } else if (node.callee.type === "MemberExpression") {
            const prop = node.callee.property.name.toUpperCase();
            if (node.callee.object.type === "CallExpression" && node.callee.object.callee.name === "Chan") {
                const chanNameArg = node.callee.object.arguments[0];
                const chanName = chanNameArg ? chanNameArg.value : "Self";
                const upName = chanNameArg ? chanName.toUpperCase() : null;
                let channelId = (chanNameArg && KernelID[upName] !== undefined) ? KernelID[upName] : (chanNameArg ? hashChannel(chanName) : this.currentKernelId);
                if (chanNameArg && KernelID[upName] === undefined) forthService.registerChannel(chanName);
                if (prop === "ON") this.channelSubscriptions.set(channelId as number, node.arguments[0]);
                else if (prop === "SEND") this.compileChannelSend(channelId, node.arguments[0]);
            }
        }
        break;
      case "BinaryExpression":
        if (node.operator === "<-") {
            this.compileChannelSend(node.left, node.right);
            return;
        }
        this.compileNode(node.left);
        this.compileNode(node.right);
        const opMap: Record<string, string> = {
            "+": "+", "-": "-", "*": "*", "/": "/", "%": "MOD", "==": "=", "!=": "<>",
            ">": ">", "<": "<", ">=": ">=", "<=": "<=", "&": "AND", "|": "OR", "^": "XOR",
            "<<": "LSHIFT", ">>": "RSHIFT", ">>>": "RSHIFT"
        };
        this.emit(`  ${opMap[node.operator] || "UNKNOWN_OP"}`);
        break;
      case "Identifier":
        const upName = node.name.toUpperCase();
        const loopIdx = this.loopVars.lastIndexOf(upName);
        if (loopIdx !== -1) {
            const depth = this.loopVars.length - 1 - loopIdx;
            if (depth === 0) this.emit(`  I`);
            else if (depth === 1) this.emit(`  J`);
            else this.emit(`  ( ERROR: Nested loops > 2 )`);
            return;
        }
        const foundScope = this.findScope(node.name);
        if (foundScope && foundScope.parent) {
             const varName = this.resolveVar(node.name);
             if (this.isStructArray(node.name)) this.emit(`  ${varName}`);
             else this.emit(`  ${varName} @`);
             return;
        }
        if (this.globalVars.has(upName)) {
            if (this.isStructArray(node.name)) this.emit(`  ${this.sanitizeName(upName)}`);
            else this.emit(`  ${this.sanitizeName(upName)} @`);
            return;
        }
        if (KNOWN_VARIABLES.has(upName)) { this.emit(`  ${upName} @`); return; }
        if (KNOWN_CONSTANTS.has(upName)) { this.emit(`  ${upName}`); return; }
        this.emit(`  ${this.sanitizeName(upName)}`);
        break;
      case "Literal":
        if (typeof node.value === "string") this.emit(`  S" ${node.value}"`);
        else if (typeof node.value === "boolean") this.emit(node.value ? `  -1` : `  0`);
        else if (typeof node.value === "number") this.emit(`  ${node.value}`);
        else this.emit(`  ${node.raw}`);
        break;
      case "IfStatement":
        this.compileNode(node.test);
        this.emit(`  IF`);
        this.compileNode(node.consequent);
        if (node.alternate) { this.emit(`  ELSE`); this.compileNode(node.alternate); }
        this.emit(`  THEN`);
        break;
      case "ReturnStatement":
        if (node.argument) this.compileNode(node.argument);
        if (this.currentScope) this.emit(`  LEAVE_FRAME`);
        this.emit(`  EXIT`);
        break;
            case "NewExpression":
        if (node.callee.name === "Array") {
            const structType = node.arguments[0].name;
            const countNode = node.arguments[1];
            this.emit(`  LP @`); // Return current LP as base address
            if (countNode.type === "Literal") {
                this.emit(`  SIZEOF_${structType.toUpperCase()} ${countNode.value} * LP +!`);
            } else {
                this.compileNode(countNode);
                this.emit(`  SIZEOF_${structType.toUpperCase()} * LP +!`);
            }
        } else if (node.arguments.length > 0) {
            this.compileNode(node.arguments[0]);
        } else {
            this.emit(`  0`);
        }
        break;
      case "ArrayExpression":
        // Pushes all elements to stack, then pushes length
        node.elements.forEach((el: any) => this.compileNode(el));
        this.emit(`  ${node.elements.length}`);
        break;
      default:
        this.emit(`  ( ERROR: UNHANDLED AST: ${node.type} )`);
    }
  }

  private static findScope(name: string): Scope | null {
      let s = this.currentScope;
      const upName = name.toUpperCase();
      while (s) {
          if (s.variables.has(upName) || s.args.has(upName)) return s;
          s = s.parent || null;
      }
      return null;
  }

  private static getMetadataName(name: string): string {
    const upName = name.toUpperCase();
    const scope = this.findScope(name);
    if (scope && scope.parent) return `LV_${scope.functionName}_${upName}`;
    return upName;
  }

  private static resolveVar(name: string): string {
    const upName = name.toUpperCase();
    const scope = this.findScope(name);
    if (scope && scope.parent) {
        const offset = scope.variables.get(upName) ?? scope.args.get(upName);
        if (offset !== undefined) return `${offset} LOCAL_VARS`;
    }
    return this.sanitizeName(name);
  }

  private static isByteType(name: string): boolean {
      const resolved = this.getMetadataName(name);
      return this.varTypes.get(resolved) === "Uint8Array";
  }

  private static getStructType(name: string): string | null {
      const resolved = this.getMetadataName(name);
      const type = this.varTypes.get(resolved);
      if (type && type.startsWith("struct ")) return type.substring(7);
      return null;
  }

  private static isStructArray(name: string): boolean {
      const resolved = this.getMetadataName(name);
      return this.structArrayCounts.has(resolved);
  }

    private static getExpressionStructType(node: ASTNode): string | null {
      if (!node) return null;
      if (node.type === "Identifier") return this.getStructType(node.name);
      if (node.type === "MemberExpression") {
          if (node.computed) return this.getExpressionStructType(node.object);
      }
      if (node.type === "NewExpression") {
          if (node.callee.name === "Array") {
              const arg0 = node.arguments[0];
              if (arg0 && arg0.type === "Identifier" && this.structs.has(arg0.name)) return arg0.name;
          }
      }
      if (node.type === "CallExpression") {
          if (node.callee.type === "Identifier") {
              const funcName = node.callee.name;
              const upName = funcName.toUpperCase();
              if (this.structs.has(funcName)) return funcName;
              if (this.exportedArrays.has(funcName)) return funcName;
              if (this.functionReturnTypes.has(upName)) return this.functionReturnTypes.get(upName)!;
          }
      }
      return null;
  }

  private static inferType(node: ASTNode): string | null {
    if (!node) return null;
    const structType = this.getExpressionStructType(node);
    if (structType) return `struct ${structType}`;
    return null;
  }

  private static sanitizeName(name: string): string {
      if (name.length <= 31) return name;
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash) + name.charCodeAt(i);
          hash |= 0;
      }
      const suffix = Math.abs(hash).toString(36).toUpperCase();
      return name.substring(0, 31 - suffix.length - 1) + "_" + suffix;
  }

  private static emit(str: string) {
    this.output.push(str);
  }

  private static emitChannelHandlers() {
      if (this.channelSubscriptions.size === 0) return;
      this.emit("( --- [AJS-CHANNELS] EVENT DISPATCHERS --- )");
      this.channelSubscriptions.forEach((callback, hash) => {
          this.emit(`  M_TARGET @ ${hash} = IF`);
          if (callback.type === "ArrowFunctionExpression" || callback.type === "FunctionExpression") {
              this.compileNode(callback.body);
          } else if (callback.type === "Identifier") {
              const funcName = callback.name.toUpperCase();
              const forthName = this.sanitizeName(funcName);
              const scope = this.scopes.find(s => s.functionName === funcName);
              if (scope && scope.args.size === 5) this.emit(`  M_OP @ M_SENDER @ M_P1 @ M_P2 @ M_P3 @ ${forthName}`);
              else if (scope && scope.args.size === 4) this.emit(`  M_OP @ M_P1 @ M_P2 @ M_P3 @ ${forthName}`);
              else this.emit(`  ${forthName}`);
          }
          this.emit(`  THEN`);
      });
  }

  private static emitSubscriptionWord() {
      this.emit("\n: AJS_INIT_CHANNELS");
      this.channelSubscriptions.forEach((_, hash) => {
          this.emit(`  SYS_CHAN_SUB ${this.currentKernelId} K_HOST ${hash} 0 0 BUS_SEND`);
      });
      this.emit(";");
  }

  private static compileChannelSend(target: any, argsNode: any) {
      if (argsNode.type !== "ArrayExpression") {
          this.emit(`  ( ERROR: Channel send expects array [op, p1, p2, p3] )`);
          return;
      }
      const elements = argsNode.elements;
      this.compileNode(elements[0] || { type: "Literal", value: 0 });
      this.emit(`  ${this.currentKernelId} ( Sender )`);
      if (typeof target === "number") this.emit(`  ${target} ( Target Channel )`);
      else this.compileNode(target);
      this.compileNode(elements[1] || { type: "Literal", value: 0 });
      this.compileNode(elements[2] || { type: "Literal", value: 0 });
      this.compileNode(elements[3] || { type: "Literal", value: 0 });
      this.emit(`  BUS_SEND`);
  }
}
