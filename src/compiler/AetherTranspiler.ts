
import * as acorn from "acorn";
import { KernelID, VSO_REGISTRY, hashChannel } from "../types/Protocol";
import { forthService } from "../services/WaForthService";

// --- TYPES ---
interface ASTNode {
  type: string;
  loc?: any;
  [key: string]: any;
}

interface Scope {
  functionName: string;
  variables: Set<string>;
  args: string[];
  varInits: Map<string, any>;
}

interface StructDef {
    name: string;
    fields: Map<string, number>; // FieldName -> ByteOffset
    size: number;
}

// Variables that are defined as VARIABLE in Forth firmware
// and must be fetched (@) when used as R-values.
const KNOWN_VARIABLES = new Set([
  "M_OP", "M_SENDER", "M_TARGET", "M_P1", "M_P2", "M_P3",
  "OUT_PTR", "STR_PTR", "LAST_PLAYER_X", "LAST_PLAYER_Y"
]);

// Constants that are defined in Forth firmware and should be used as-is.
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
  private static scopes: Scope[] = [];
  private static currentScope: Scope | null = null;
  private static output: string[] = [];
  private static loopVars: string[] = []; // Stack of active loop variables for I/J mapping
  private static structs: Map<string, StructDef> = new Map();
  // Global map of ALL field names to offsets (Simplification: assumes unique fields globally or shared layout)
  private static globalFieldOffsets: Map<string, number> = new Map();
  private static currentKernelId: number = 0;
  private static globalVars: Set<string> = new Set();
  private static globalConsts: Map<string, any> = new Map();
  private static varTypes: Map<string, string> = new Map(); // Name -> "Uint8Array" | "Uint32Array" | etc
  private static structArrayCounts: Map<string, any> = new Map();
  private static exportedArrays: Map<string, string> = new Map(); // StructName -> VarName (Local)
  private static localStructs: Set<string> = new Set();
  private static functionReturnTypes: Map<string, string> = new Map();
  private static channelSubscriptions: Map<number, ASTNode> = new Map();
  private static debugMode: boolean = false;

  // Shared across transpile() calls for different kernels
  private static globalExportRegistry: Map<string, { owner: number, varName: string, typeId: number, sizeBytes: number, fields: Map<string, number> }> = new Map();
  private static nextVsoTypeId = 1000;

  static reset() {
      this.structs = new Map();
      this.globalFieldOffsets = new Map();
      this.globalExportRegistry = new Map();
      this.nextVsoTypeId = 1000;
      this.loadVsoRegistry();
  }

  static loadVsoRegistry() {
      for (const [name, def] of Object.entries(VSO_REGISTRY)) {
          const structDef: StructDef = {
              name,
              fields: new Map(),
              size: def.sizeBytes
          };
          def.fields.forEach((f, i) => {
              const offset = i * 4;
              structDef.fields.set(f, offset);
              // DO NOT populate globalFieldOffsets here.
              // VSO field offsets are handled via prefixed constants.
          });
          this.structs.set(name, structDef);
      }

      // Also load from global export registry for dynamic cross-kernel structs
      this.globalExportRegistry.forEach((def, name) => {
          if (!this.structs.has(name)) {
              const structDef: StructDef = {
                  name,
                  fields: def.fields,
                  size: def.sizeBytes
              };
              this.structs.set(name, structDef);
              // Do NOT populate globalFieldOffsets from remote exports
              // to avoid collisions. Use prefixed offsets.
          }
      });
  }

  static transpile(jsCode: string, kernelId: number = 0, debugMode: boolean = false): string {
    this.debugMode = debugMode;
    // Clear local state but keep VSO definitions
    this.structs = new Map();
    this.globalFieldOffsets = new Map();
    this.loadVsoRegistry();

    this.scopes = [];
    this.output = [];
    this.currentScope = null;
    this.loopVars = [];
    // this.structs and this.globalFieldOffsets are persistent
    this.currentKernelId = kernelId;
    this.globalVars = new Set();
    this.globalConsts = new Map();
    this.varTypes = new Map();
    this.structArrayCounts = new Map();
    this.exportedArrays = new Map();
    this.localStructs = new Set();
    this.functionReturnTypes = new Map();
    this.channelSubscriptions = new Map();

    if (!jsCode || !jsCode.trim()) {
        return "";
    }

    // Ensure we are in DECIMAL mode for literal addresses emitted by transpiler
    this.emit("DECIMAL");

    // Pre-Process Struct Definitions (ACORN doesn't handle "struct")
    // Syntax: struct Name { field1, field2 }
    const processedCode = this.extractStructs(jsCode);

    try {
      const ast = acorn.parse(processedCode, { ecmaVersion: 2020, locations: true });
      this.emitStructs();
      this.analyzeScopes(ast as ASTNode);
      this.emitGlobals();
      this.compileNode(ast as ASTNode);
      this.emitSubscriptionWord();
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
      
      // We remove the structs and exports from JS code so Acorn handles the rest,
      // but we parse them to build offsets.
      let cleanCode = code;

      while ((match = structRegex.exec(code)) !== null) {
          const name = match[1];
          const fieldsStr = match[2];
          const fields = fieldsStr.split(',').map(s => s.trim()).filter(s => s);
          
          this.localStructs.add(name);

          const existing = this.structs.get(name);
          if (existing) {
              // Verify consistency (Simplified: just check field count for now)
              if (existing.fields.size !== fields.length) {
                  throw new Error(`Struct '${name}' re-defined with different number of fields. Existing: ${existing.fields.size}, New: ${fields.length}`);
              }
              // Ensure local re-definition (from VSO) takes precedence for field offsets
              existing.fields.forEach((offset, f) => {
                  this.globalFieldOffsets.set(f, offset);
              });
          } else {
              const def: StructDef = {
                  name,
                  fields: new Map(),
                  size: fields.length * 4
              };

              fields.forEach((f, i) => {
                  const offset = i * 4;
                  def.fields.set(f, offset);

                  if (this.globalFieldOffsets.has(f) && this.globalFieldOffsets.get(f) !== offset) {
                      throw new Error(`Field offset collision for field '${f}' in struct '${name}'. Existing offset: ${this.globalFieldOffsets.get(f)}, new offset: ${offset}. Field names must have consistent offsets across all structs within the same kernel.`);
                  }

                  this.globalFieldOffsets.set(f, offset);
              });

              this.structs.set(name, def);
          }
          
          // Remove from source code to avoid parse error
          cleanCode = cleanCode.replace(match[0], "");
      }

      // Handle exports
      while ((match = exportRegex.exec(code)) !== null) {
          const varName = match[1];
          // We don't know the type yet, so we'll resolve it in analyzeScopes
          this.exportedArrays.set("__PENDING_" + varName, varName);
          cleanCode = cleanCode.replace(match[0], "");
      }

      return cleanCode;
  }

  private static emitStructs() {
      if (this.structs.size === 0) return;
      this.emit("( --- STRUCT OFFSETS --- )");
      this.structs.forEach(def => {
          this.emit(`( Struct: ${def.name} )`);
          const structUpper = def.name.toUpperCase();
          this.emit(`${def.size} CONSTANT SIZEOF_${structUpper}`);
          def.fields.forEach((offset, fieldName) => {
              const fieldUpper = fieldName.toUpperCase();
              // Prefixed constant to avoid global collisions
              this.emit(`${offset} CONSTANT OFF_${structUpper}_${fieldUpper}`);

              // Only emit fallback legacy constant for structs defined in the local kernel
              // to avoid collisions between VSO structs (e.g. GridEntity.x vs HiveEntity.x)
              if (this.localStructs.has(def.name)) {
                  this.emit(`${offset} CONSTANT OFF_${fieldUpper}`);
              }
          });
      });
      this.emit("( --------------------- )");
  }

  // --- PASS 1: ANALYSIS ---
  private static analyzeScopes(node: ASTNode) {
    if (node.type === "Program") {
      node.body.forEach((n: any) => {
        if (n.type === "VariableDeclaration") {
          n.declarations.forEach((decl: any) => {
            const name = decl.id.name.toUpperCase();

            // Detect Type Hints: const x = new Uint8Array(...)
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

      // Resolve pending exports
      const pending = Array.from(this.exportedArrays.keys()).filter(k => k.startsWith("__PENDING_"));
      pending.forEach(pk => {
          const varName = this.exportedArrays.get(pk)!;
          const structType = this.getStructType(varName);
          if (structType) {
              const upperVarName = varName.toUpperCase();
              this.exportedArrays.set(structType, upperVarName);

              // Register in global registry for cross-kernel access
              const structDef = this.structs.get(structType);
              if (structDef) {
                  if (!AetherTranspiler.globalExportRegistry.has(structType)) {
                      // Check if it's a known VSO from Protocol.ts first
                      let typeId = AetherTranspiler.nextVsoTypeId++;

                      // Actually, VSO_REGISTRY is keyed by struct name
                      if (VSO_REGISTRY[structType]) {
                          typeId = VSO_REGISTRY[structType].typeId;
                      }

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
      const args = node.params.map((p: any) => p.name.toUpperCase());
      
      const scope: Scope = {
        functionName: funcName,
        variables: new Set(),
        args: args,
        varInits: new Map()
      };
      
      this.findVariables(node.body, scope);
      this.scopes.push(scope);

      // Infer Return Type
      const returnType = this.findReturnType(node.body);
      if (returnType) {
          this.functionReturnTypes.set(funcName, returnType);
      }
    }
    
    if (node.type === "CallExpression" && node.callee.type === "MemberExpression") {
        const prop = node.callee.property.name.toUpperCase();
        if (prop === "ON" && node.callee.object.type === "CallExpression" && node.callee.object.callee.name === "Chan") {
            const chanNameArg = node.callee.object.arguments[0];
            let channelId;
            if (!chanNameArg) {
                channelId = this.currentKernelId;
            } else {
                const chanName = chanNameArg.value;
                const upName = chanName.toUpperCase();
                channelId = hashChannel(chanName);
                if (KernelID[upName] !== undefined) {
                    channelId = KernelID[upName] as number;
                } else {
                    forthService.registerChannel(chanName);
                }
            }
            const callback = node.arguments[0];
            this.channelSubscriptions.set(channelId, callback);
        }
    }

    // Generic children traversal for analyzeScopes
    for (const key in node) {
        const child = node[key];
        if (child && typeof child === "object" && child.type) {
            this.analyzeScopes(child);
        } else if (Array.isArray(child)) {
            child.forEach(c => {
                if (c && typeof c === "object" && c.type) this.analyzeScopes(c);
            });
        }
    }
  }

  private static findReturnType(node: ASTNode): string | null {
      if (!node) return null;
      if (node.type === "ReturnStatement") {
          return this.inferType(node.argument);
      }
      if (Array.isArray(node)) {
          for (const n of node) {
              const t = this.findReturnType(n);
              if (t) return t.startsWith("struct ") ? t.substring(7) : t;
          }
      }
      if (typeof node === 'object') {
          for (const key of Object.keys(node)) {
              if (key === "type") continue;
              const t = this.findReturnType(node[key]);
              if (t) return t.startsWith("struct ") ? t.substring(7) : t;
          }
      }
      return null;
  }

  private static findVariables(node: ASTNode, scope: Scope) {
    if (!node) return;
    
    if (node.type === "VariableDeclaration") {
      node.declarations.forEach((decl: any) => {
        const name = decl.id.name.toUpperCase();
        scope.variables.add(name);

        if (decl.init) {
                const rawFullName = `LV_${scope.functionName}_${name}`;
                const fullName = this.sanitizeName(rawFullName);
            if ((decl.init.type === "NewExpression" || decl.init.type === "CallExpression") &&
                decl.init.callee.name && (decl.init.callee.name.includes("Uint8") || decl.init.callee.name.includes("Uint32") || decl.init.callee.name.includes("Int32"))) {
                this.varTypes.set(fullName, decl.init.callee.name);
            } else if (decl.init.type === "NewExpression" && decl.init.callee.name === "Array") {
                const firstArg = decl.init.arguments[0];
                const secondArg = decl.init.arguments[1];
                const thirdArg = decl.init.arguments[2];
                if (firstArg && firstArg.type === "Identifier" && this.structs.has(firstArg.name)) {
                    this.varTypes.set(fullName, `struct ${firstArg.name}`);
                    if (secondArg) {
                        if (secondArg.type === "Literal") {
                            this.structArrayCounts.set(fullName, secondArg.value);
                        } else if (secondArg.type === "Identifier") {
                            this.structArrayCounts.set(fullName, secondArg.name.toUpperCase());
                        }
                    }
                    if (thirdArg && thirdArg.type === "Literal") {
                        // Local constant-addressed array (rare but supported)
                        this.globalConsts.set(fullName, thirdArg);
                    }
                    scope.varInits.set(name, decl.init);
                }
            } else if (decl.init.type === "ArrayExpression") {
                this.varTypes.set(fullName, `DynamicArray`);
                scope.varInits.set(name, decl.init);
            }
        }
      });
    }

    Object.keys(node).forEach(key => {
        const child = node[key];
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

    // 0. Channel Initialization Flag
    this.emit("VARIABLE CHANNELS_INITED");
    this.emit("0 CHANNELS_INITED !");

    // 0.1 Initialize Heap
    this.emit("INIT_HEAP");

    // 1. Emit simple constants first
    this.globalConsts.forEach((init, rawName) => {
      const name = this.sanitizeName(rawName);
      if (this.isStructArray(rawName)) return;

      let val = 0;
      if (init) {
          if (init.type === "Literal") {
            val = init.value;
          } else if (init.type === "Identifier") {
              const constInit = this.globalConsts.get(init.name.toUpperCase());
              if (constInit && constInit.type === "Literal") {
                  val = constInit.value;
              }
          } else if (init.type === "NewExpression" || init.type === "CallExpression") {
              // Handle new Uint8Array(0x30000) -> 0x30000
              if (init.arguments && init.arguments.length > 0) {
                  const arg0 = init.arguments[0];
                  if (arg0.type === "Literal") {
                      val = arg0.value;
                  } else if (arg0.type === "Identifier") {
                      const constInit = this.globalConsts.get(arg0.name.toUpperCase());
                      if (constInit && constInit.type === "Literal") {
                          val = constInit.value;
                      }
                  }
              }
          }
      }
      this.emit(`${val} CONSTANT ${name}`);
    });

    // 2. Emit Top-Level Variables (including struct arrays)
    this.globalVars.forEach(rawV => {
      if (KNOWN_GLOBALS.has(rawV)) return; // Skip firmware globals
      const v = this.sanitizeName(rawV);
      if (this.isStructArray(rawV)) {
          const structName = this.getStructType(rawV);
          const count = this.structArrayCounts.get(rawV) || 0;

          const constInit = this.globalConsts.get(rawV);
          if (constInit && constInit.type === "Literal" && typeof constInit.value === "number") {
               this.emit(`${constInit.value} CONSTANT ${v}`);
          } else {
               this.emit(`CREATE ${v} ${count} SIZEOF_${structName?.toUpperCase()} * ALLOT`);
          }

          const entry = AetherTranspiler.globalExportRegistry.get(structName!);
          if (entry && entry.owner === this.currentKernelId && entry.varName === rawV) {
              this.emit(`${v} ${entry.typeId} ${entry.sizeBytes} JS_REGISTER_VSO`);
          }
      } else {
          this.emit(`VARIABLE ${v}`);
      }
    });

    // 3. Emit struct arrays that were declared as 'const'
    this.globalConsts.forEach((init, rawName) => {
        if (!this.isStructArray(rawName)) return;
        if (this.globalVars.has(rawName)) return; // Already emitted

        const name = this.sanitizeName(rawName);
        const structName = this.getStructType(rawName);
        const count = this.structArrayCounts.get(rawName) || 0;

        if (init && init.type === "Literal" && typeof init.value === "number") {
             this.emit(`${init.value} CONSTANT ${name}`);
        } else {
             this.emit(`CREATE ${name} ${count} SIZEOF_${structName?.toUpperCase()} * ALLOT`);
        }

        const entry = AetherTranspiler.globalExportRegistry.get(structName!);
        if (entry && entry.owner === this.currentKernelId && entry.varName === rawName) {
            this.emit(`${name} ${entry.typeId} ${entry.sizeBytes} JS_REGISTER_VSO`);
        }
    });

    // 4. Emit Local Variables
    this.scopes.forEach(scope => {
      scope.args.forEach(arg => {
        const fullName = this.sanitizeName(`LV_${scope.functionName}_${arg}`);
        this.emit(`VARIABLE ${fullName}`);
      });
      scope.variables.forEach(v => {
        const rawFullName = `LV_${scope.functionName}_${v}`;
        const fullName = this.sanitizeName(rawFullName);
        if (this.isStructArray(rawFullName)) {
            const structName = this.getStructType(rawFullName);
            const count = this.structArrayCounts.get(rawFullName) || 0;
            this.emit(`CREATE ${fullName} ${count} SIZEOF_${structName?.toUpperCase()} * ALLOT`);

            const entry = AetherTranspiler.globalExportRegistry.get(structName!);
            if (entry && entry.owner === this.currentKernelId && entry.varName === rawFullName) {
                this.emit(`${fullName} ${entry.typeId} ${entry.sizeBytes} JS_REGISTER_VSO`);
            }
        } else {
            this.emit(`VARIABLE ${fullName}`);
        }
      });
    });
    this.emit("( ------------------------- )");
  }

  // --- PASS 2: COMPILATION ---
  private static emitTrace(node: ASTNode) {
      if (!this.debugMode) return;
      if (node.loc && node.loc.start && node.loc.start.line) {
          const line = node.loc.start.line;
          this.emit(`  ( -- Line ${line} -- )`);
          this.emit(`  DEBUG_MODE_PTR @ IF ${line} JS_TRACE THEN`);
      }
  }

  private static compileNode(node: ASTNode) {
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
        
        if (scope && scope.args.length > 0) {
            [...scope.args].reverse().forEach(arg => {
                this.emit(`  LV_${name}_${arg} !`);
            });
        }

        
        this.compileNode(node.body);

        if (name === "HANDLE_EVENTS") {
            this.emitChannelHandlers();
        }
        
        this.emit(`;`);
        this.currentScope = null;
        break;

      case "BlockStatement":
        node.body.forEach((n: any) => this.compileNode(n));

        // GC for DynamicArrays at end of block
        if (this.currentScope && node.body.every((n: any) => n.type !== "ReturnStatement")) {
            this.emitGCForScope(false);
        }
        break;

      case "VariableDeclaration":
        this.emitTrace(node);
        node.declarations.forEach((decl: any) => {
           if (decl.init) {
               const varName = this.resolveVar(decl.id.name);
               // If it's a top-level constant, it's already defined
               if (this.globalConsts.has(varName)) {
                   return;
               }
               // If it's a struct array, it's already handled by CREATE ... ALLOT in emitGlobals
               if (this.isStructArray(decl.id.name)) {
                   return;
               }

               if (decl.init.type === "ArrayExpression") {
                   // Dynamic Array Allocation
                   // Create fat pointer struct in memory: {head, tail, len}
                   // Wait, we can just allocate 3 cells using ALLOC_CHUNK
                   // and use it to hold the fat pointer itself.
                   this.emit(`  ALLOC_CHUNK DUP ${varName} !`); // Head chunk will hold the pointer info
                   // First cell (0): Head of list
                   // Second cell (4): Tail of list
                   // Third cell (8): Length
                   this.emit(`  ALLOC_CHUNK OVER !`); // Allocate first chunk, set as head
                   this.emit(`  DUP @ OVER 4 + !`); // Tail = Head
                   this.emit(`  0 OVER 8 + !`); // Len = 0
                   this.emit(`  DROP`);

                   decl.init.elements.forEach((el: any) => {
                       // arr.push(el) equivalent
                       this.compileNode(el);
                       // Stack: [val]

                       this.emit(`  ${varName} @`);
                       // Stack: [val, fat_ptr]

                       this.emit(`  ( -- DynamicArray PUSH -- )`);
                       this.emit(`  DUP 8 + @`);
                       // Stack: [val, fat_ptr, len]

                       this.emit(`  DUP 15 MOD 0= OVER 0> AND IF`);
                       // Need new chunk
                       this.emit(`    ALLOC_CHUNK`); // [val, fat_ptr, len, new_chunk]
                       this.emit(`    DUP 3 PICK 4 + @ !`); // [val, fat_ptr, len, new_chunk] -> old_tail.next = new_chunk
                       this.emit(`    2 PICK 4 + !`); // [val, fat_ptr, len] -> fat_ptr.tail = new_chunk
                       this.emit(`  THEN`);

                     // Stack: [val, fat_ptr, len]
                     this.emit(`  15 MOD 1+ CELLS`); // [val, fat_ptr, offset]
                     this.emit(`  OVER 4 + @ +`);   // [val, fat_ptr, target_addr]

                     // Stack: [val, fat_ptr, target_addr]
                     // we want to store `val` at `target_addr`
                     // ROT -> [fat_ptr, target_addr, val]
                     // SWAP -> [fat_ptr, val, target_addr]
                     // ! -> stores val at target_addr, leaves [fat_ptr]
                     this.emit(`  ROT SWAP !`);     // target_addr ! val, leaves [fat_ptr]

                     // We need to increment len
                     // Stack: [fat_ptr]
                     this.emit(`  1 SWAP 8 + +!`);  // fat_ptr.len += 1
                   });

                   this.varTypes.set(varName, "DynamicArray");
               } else {
                   this.compileNode(decl.init);
                   this.emit(`  ${varName} !`);

                   const rhsType = this.inferType(decl.init);
                   if (rhsType) {
                       this.varTypes.set(varName, rhsType);
                   }
               }
           }
        });
        break;

      case "ExpressionStatement":
        this.emitTrace(node);
        this.compileNode(node.expression);
        if (this.debugMode) {
           this.emit(`  DEBUG_MODE_PTR @ IF DEPTH JS_ASSERT_STACK THEN`);
        }
        break;
      
      case "WhileStatement":
        this.emitTrace(node);
        this.emit(`  BEGIN`);
        this.compileNode(node.test);
        this.emit(`  WHILE`);
        this.compileNode(node.body);
        this.emit(`  REPEAT`);
        break;

      case "ForStatement":
        this.emitTrace(node);
        // Generic For Loop mapped to BEGIN .. WHILE .. REPEAT
        if (node.init) {
            this.compileNode(node.init);
        }

        this.emit(`  BEGIN`);

        if (node.test) {
            this.compileNode(node.test);
            this.emit(`  WHILE`);
        }

        this.compileNode(node.body);

        if (node.update) {
            this.compileNode(node.update);
            // update usually leaves a value or just evaluates.
            // In AJS, update is usually assignment or update expression which handles drop internally or we handle it if it leaves a value?
            // Actually, UpdateExpression (++ / -- / +=) generates `+!` which leaves NO value. So we are good.
        }

        this.emit(`  REPEAT`);
        break;

      case "ForOfStatement":
        this.emitTrace(node);
        // for (let item of arr)
        if (node.left.type === 'VariableDeclaration' && node.left.declarations.length === 1 && node.right.type === 'Identifier') {
            const itemName = node.left.declarations[0].id.name;
            const itemVar = this.resolveVar(itemName);
            const arrName = this.resolveVar(node.right.name);
            
            // Check if Dynamic Array
            if (this.varTypes.get(arrName) === "DynamicArray") {
                // Initialize loop vars
                // We need to track: items_processed, total_length, current_chunk_ptr, internal_index
                // Using locals for this to keep stack clean and avoid DUP/ROT hell
                this.emit(`  ( -- ForOf DynamicArray -- )`);
                this.emit(`  ${arrName} @ 8 + @ ( Limit )`);
                this.emit(`  0 ( Index )`);
                this.emit(`  BEGIN 2DUP > WHILE`);
                // Stack: [Limit, Index]
                // item = arr[Index]
                this.emit(`  DUP >R ( Save Index )`);
                this.emit(`  ${arrName} @ SWAP ARRAY_GET_ADDR @ ( fetch value )`);
                this.emit(`  ${itemVar} ! ( store in item )`);

                // Execute body
                this.compileNode(node.body);

                this.emit(`  R> 1 + ( Index++ )`);
                this.emit(`  REPEAT`);
                this.emit(`  2DROP`);
            } else {
                this.emit(`  ( ERROR: ForOf only supported for DynamicArrays right now )`);
            }
        }
        break;

      // --- LOGIC ---
      
      case "LogicalExpression":
        // Handle short-circuiting logic: a && b stops if a is false
        if (node.operator === "&&") {
            this.compileNode(node.left);
            this.emit(`  DUP IF DROP`); // If true, drop it and evaluate right
            this.compileNode(node.right);
            this.emit(`  THEN`);
        } else if (node.operator === "||") {
            this.compileNode(node.left);
            this.emit(`  DUP 0= IF DROP`); // If false, drop it and evaluate right
            this.compileNode(node.right);
            this.emit(`  THEN`);
        }
        break;

      case "UnaryExpression":
        this.compileNode(node.argument);
        if (node.operator === "!") this.emit(`  0=`);
        else if (node.operator === "-") this.emit(`  NEGATE`);
        else if (node.operator === "~") this.emit(`  INVERT`);
        break;

      case "UpdateExpression":
        // i++ -> 1 i +!
        if (node.argument.type === "Identifier") {
            const varName = this.resolveVar(node.argument.name); // returns Name
            const val = node.operator === "++" ? "1" : "-1";
            this.emit(`  ${val} ${varName} +!`);
        } else if (node.argument.type === "MemberExpression" && !node.argument.computed) {
            const propName = node.argument.property.name;
            const structType = this.getExpressionStructType(node.argument.object);
            const offConst = structType ? `OFF_${structType.toUpperCase()}_${propName.toUpperCase()}` : `OFF_${propName.toUpperCase()}`;
            const val = node.operator === "++" ? "1" : "-1";

            this.emit(`  ${val}`);
            this.compileNode(node.argument.object); // Ptr
            this.emit(`  ${offConst} + +!`);
        }
        break;

      case "AssignmentExpression":
        // HANDLE BYTE MEMORY ASSIGNMENT: MEM8[addr] = val
        if (node.left.type === "MemberExpression" && 
            node.left.object.type === "Identifier" && 
            node.left.object.name === "MEM8") {
             this.compileNode(node.right); // Value (Stack: val)
             this.compileNode(node.left.property); // Address (Stack: val addr)
             this.emit(`  C!`); // Store Byte
        }
        // HANDLE CELL MEMORY ASSIGNMENT: MEM32[addr] = val
        else if (node.left.type === "MemberExpression" && 
                 node.left.object.type === "Identifier" && 
                 node.left.object.name === "MEM32") {
             this.compileNode(node.right); // Value
             this.compileNode(node.left.property); // Address
             this.emit(`  !`); // Store Cell
        }
        else if (node.left.type === "Identifier") {
            const varName = this.resolveVar(node.left.name); // returns Name (Address)
            
            if (node.operator === "=") {
                this.compileNode(node.right); // Value
                this.emit(`  ${varName} !`); // Store

                const rhsType = this.inferType(node.right);
                if (rhsType) {
                    this.varTypes.set(varName, rhsType);
                }
            } else if (node.operator === "+=") {
                this.compileNode(node.right);
                this.emit(`  ${varName} +!`);
            } else if (node.operator === "-=") {
                this.compileNode(node.right);
                this.emit(`  NEGATE ${varName} +!`);
            } else {
                // *=, /=
                this.compileNode(node.right);
                this.emit(`  ${varName} @`); // Fetch current value
                this.emit(`  SWAP`); 
                if (node.operator === "*=") this.emit(`  *`);
                if (node.operator === "/=") this.emit(`  /`);
                this.emit(`  ${varName} !`);
            }
        } 
        // HANDLE STRUCT ASSIGNMENT: ent.hp = 10, ent.hp += 10
        else if (node.left.type === "MemberExpression" && !node.left.computed) {
            const propName = node.left.property.name;
            const structType = this.getExpressionStructType(node.left.object);
            const offConst = structType ? `OFF_${structType.toUpperCase()}_${propName.toUpperCase()}` : `OFF_${propName.toUpperCase()}`;

            const offset = structType ? this.structs.get(structType)?.fields.get(propName) : this.globalFieldOffsets.get(propName);
            
            if (offset !== undefined) {
                 if (node.operator === "=") {
                     this.compileNode(node.right); // Val
                     this.compileNode(node.left.object); // Ptr
                     this.emit(`  ${offConst} + !`);
                 } else if (node.operator === "+=") {
                     this.compileNode(node.right); // Val
                     this.compileNode(node.left.object); // Ptr
                     this.emit(`  ${offConst} + +!`);
                 } else if (node.operator === "-=") {
                     this.compileNode(node.right); // Val
                     this.emit(`  NEGATE`); 
                     this.compileNode(node.left.object); // Ptr
                     this.emit(`  ${offConst} + +!`);
                 } else {
                     // *=, /=
                     this.compileNode(node.left.object); // Ptr
                     this.emit(`  ${offConst} +`); // Addr
                     this.emit(`  DUP @`); // Addr OldVal
                     this.compileNode(node.right); // Addr OldVal Operand
                     
                     if (node.operator === "*=") this.emit(`  *`);
                     else if (node.operator === "/=") this.emit(`  /`);
                     
                     this.emit(`  SWAP !`);
                 }
            } else {
                 this.emit(`  ( UNKNOWN FIELD: ${propName} ) DROP`);
            }
        }
        // HANDLE ARRAY ASSIGNMENT: arr[i] = 10
        else if (node.left.type === "MemberExpression" && node.left.computed) {
            this.compileNode(node.right); // Pushes Value
            this.compileNode(node.left.object); // Pushes Base Address
            this.compileNode(node.left.property); // Pushes Index
            
            const isByte = node.left.object.type === "Identifier" && this.isByteType(node.left.object.name);
            const structType = this.getExpressionStructType(node.left.object);

            let isDynamicArray = false;
            if (node.left.object.type === "Identifier") {
                const varName = this.resolveVar(node.left.object.name);
                if (this.varTypes.get(varName) === "DynamicArray") {
                    isDynamicArray = true;
                }
            }

            if (node.operator === "=") {
                if (isDynamicArray) {
                    this.emit(`  SWAP @ SWAP ARRAY_GET_ADDR !`); // arr.head index ARRAY_GET_ADDR !
                } else if (isByte) {
                    this.emit(`  + C!`);
                } else if (structType) {
                    this.emit(`  SIZEOF_${structType.toUpperCase()} * + !`);
                } else {
                    this.emit(`  CELLS + !`);
                }
            } else if (node.operator === "+=") {
                if (isDynamicArray) {
                    this.emit(`  SWAP @ SWAP ARRAY_GET_ADDR +!`); // arr.head index ARRAY_GET_ADDR +!
                } else if (isByte) {
                    this.emit(`  + DUP C@ ROT + SWAP C!`); // Complex because no C+! in standard forth usually
                } else if (structType) {
                    this.emit(`  SIZEOF_${structType.toUpperCase()} * + +!`);
                } else {
                    this.emit(`  CELLS + +!`);
                }
            } else {
                 this.emit(`  ( TODO: Complex Array assignment op ) 2DROP DROP`);
            }
        }
        else {
            this.emit(`  ( TODO: Assign to complex lvalue ) DROP`);
        }
        break;

      // HANDLE READS
      case "MemberExpression":
        if (node.object.type === "Identifier" && node.object.name === "MEM8") {
            // HANDLE BYTE READ: MEM8[addr]
            this.compileNode(node.property); // Address
            this.emit(`  C@`); // Fetch Byte
        }
        else if (node.object.type === "Identifier" && node.object.name === "MEM32") {
            // HANDLE CELL READ: MEM32[addr]
            this.compileNode(node.property); // Address
            this.emit(`  @`); // Fetch Cell
        }
        else if (node.computed) {
            // HANDLE ARRAY READ: arr[i]
            this.compileNode(node.object); // Base Address
            this.compileNode(node.property); // Index

            let isDynamicArray = false;
            if (node.object.type === "Identifier") {
                const varName = this.resolveVar(node.object.name);
                if (this.varTypes.get(varName) === "DynamicArray") {
                    isDynamicArray = true;
                }
            }

            const isByte = node.object.type === "Identifier" && this.isByteType(node.object.name);
            const structType = this.getExpressionStructType(node.object);

            if (isDynamicArray) {
                this.emit(`  SWAP @ SWAP ARRAY_GET_ADDR @`);
            } else if (isByte) {
                this.emit(`  + C@`);
            } else if (structType) {
                this.emit(`  SIZEOF_${structType.toUpperCase()} * +`); // Just return pointer for struct arrays
            } else {
                this.emit(`  CELLS + @`);
            }
        } 
        else if (!node.computed) {
             // HANDLE STRUCT READ: ent.hp
             const propName = node.property.name;
             const structType = this.getExpressionStructType(node.object);
             const offConst = structType ? `OFF_${structType.toUpperCase()}_${propName.toUpperCase()}` : `OFF_${propName.toUpperCase()}`;

             const offset = structType ? this.structs.get(structType)?.fields.get(propName) : this.globalFieldOffsets.get(propName);

             if (offset !== undefined) {
                 this.compileNode(node.object); // Ptr
                 this.emit(`  ${offConst} + @`);
             } else {
                 // Might be Math.max etc
                 const obj = node.object.name ? node.object.name.toUpperCase() : "UNKNOWN";
                 const prop = node.property.name ? node.property.name.toUpperCase() : "UNKNOWN";
                 this.emit(`  ( UNHANDLED PROP ACCESS: ${obj}.${prop} )`);
             }
        }
        else {
             this.emit(`  ( UNHANDLED ACCESS )`);
        }
        break;

      case "CallExpression":
        if (node.callee.type === "Identifier") {
            const funcName = node.callee.name;
            const func = funcName.toUpperCase();

            if (func === "CHAN") {
                const arg = node.arguments[0];
                if (!arg) {
                    this.emit(`  ${this.currentKernelId} ( Self Channel )`);
                } else if (arg.type === "Literal" && typeof arg.value === "string") {
                    const name = arg.value.toUpperCase();
                    // Check if it's a known Kernel name
                    if (KernelID[name] !== undefined) {
                        this.emit(`  K_${name}`);
                    } else {
                        const hash = hashChannel(arg.value);
                        forthService.registerChannel(arg.value);
                        this.emit(`  ${hash} ( Channel: ${arg.value} )`);
                    }
                } else if (arg) {
                    this.compileNode(arg);
                }
                return;
            }

            // --- EXPORTED STRUCT ARRAY ACCESS: NPC(id) ---
            const globalEntry = AetherTranspiler.globalExportRegistry.get(funcName);
            if (globalEntry) {
                if (globalEntry.owner === this.currentKernelId) {
                    this.compileNode(node.arguments[0]);
                    this.emit(`  ${globalEntry.varName} SWAP SIZEOF_${func} * +`);
                } else {
                    this.compileNode(node.arguments[0]);
                    this.emit(`  ${globalEntry.typeId} JS_SYNC_OBJECT`);
                }
                return;
            }
        }

        if (node.callee.type === "MemberExpression") {
            const prop = node.callee.property.name.toUpperCase();

            // Handle Chan("name").on(...) and Chan("name").send(...)
            if (node.callee.object.type === "CallExpression" && node.callee.object.callee.name === "Chan") {
                const chanNameArg = node.callee.object.arguments[0];
                const chanName = chanNameArg ? chanNameArg.value : "Self";
                const upName = chanNameArg ? chanName.toUpperCase() : null;

                let channelId;
                if (!chanNameArg) {
                    channelId = this.currentKernelId;
                } else if (KernelID[upName] !== undefined) {
                    channelId = KernelID[upName] as number;
                } else {
                    channelId = hashChannel(chanName);
                    forthService.registerChannel(chanName);
                }

                if (prop === "ON") {
                    this.emit(`  ( Subscribed to Channel: ${chanName} )`);
                    return;
                } else if (prop === "LEAVE") {
                    this.emit(`  SYS_CHAN_UNSUB MY_ID @ K_HOST 0 ${channelId} 0 BUS_SEND ( UNSUB FROM ${chanName} )`);
                    return;
                } else if (prop === "SEND") {
                    this.compileChannelSend(channelId, node.arguments[0]);
                    return;
                }
            }
        }

        node.arguments.forEach((arg: any) => {
            this.compileNode(arg);
        });

        if (node.callee.type === "Identifier") {
            const funcName = node.callee.name;
            const func = funcName.toUpperCase();

            // Type "Casts" / Mappings
            if (func === "UINT8ARRAY" || func === "UINT32ARRAY") {
                // If it's a mapping like Uint8Array(0x30000), just return the address
                return;
            }

            // --- VIRTUAL SHARED OBJECTS (VSO) SUPPORT ---
            if (VSO_REGISTRY[funcName]) {
                const entry = VSO_REGISTRY[funcName];
                // node.arguments[0] is the ID
                this.compileNode(node.arguments[0]);
                if (entry.owner === this.currentKernelId) {
                    // LOCAL ACCESS: return Base + (id * Size)
                    this.emit(`  ${entry.sizeBytes} * ${entry.baseAddr} +`);
                } else {
                    // REMOTE ACCESS: call sync_object(id, typeId)
                    this.emit(`  VSO_${func} JS_SYNC_OBJECT`);
                }
                return;
            }

            if (func === "PEEK") this.emit(`  @`);
            else if (func === "POKE") this.emit(`  !`);
            else if (func === "CPEEK") this.emit(`  C@`);
            else if (func === "CPOKE") this.emit(`  C!`);
            else if (func === "JS_REGISTER_VSO") this.emit(`  JS_REGISTER_VSO`);
            else if (func === "JS_SYNC_OBJECT") this.emit(`  JS_SYNC_OBJECT`);
            else if (func === "LOG") {
                const arg0 = node.arguments[0];
                if (arg0 && arg0.type === "Literal" && typeof arg0.value === "string") {
                    this.emit(`  S.`);
                } else {
                    this.emit(`  .N`);
                }
            }
            else this.emit(`  ${this.sanitizeName(func)}`);
        } 
        else if (node.callee.type === "MemberExpression") {
            if (node.callee.property.name === "push" && node.callee.object.type === "Identifier") {
                const varName = this.resolveVar(node.callee.object.name);
                if (this.varTypes.get(varName) === "DynamicArray") {
                     // Node.arguments were already compiled and put on stack
                     // Stack: [val]
                     this.emit(`  ${varName} @`);
                     // Stack: [val, fat_ptr]
                     this.emit(`  ( -- DynamicArray PUSH -- )`);
                     this.emit(`  DUP 8 + @`); // [val, fat_ptr, len]
                     this.emit(`  DUP 15 MOD 0= OVER 0> AND IF`);
                     this.emit(`    ALLOC_CHUNK`); // [val, fat_ptr, len, new_chunk]
                     this.emit(`    DUP 3 PICK 4 + @ !`); // [val, fat_ptr, len, new_chunk] -> old_tail.next = new_chunk
                     this.emit(`    2 PICK 4 + !`); // [val, fat_ptr, len] -> fat_ptr.tail = new_chunk
                     this.emit(`  THEN`);

                     this.emit(`  15 MOD 1+ CELLS`); // [val, fat_ptr, offset]
                     this.emit(`  OVER 4 + @ +`);   // [val, fat_ptr, target_addr]
                     this.emit(`  ROT SWAP !`);     // [fat_ptr]
                     this.emit(`  1 SWAP 8 + +!`);  // []
                     return;
                }
            }

            const prop = node.callee.property.name.toUpperCase();
            // Ensure object has a name (Identifier)
            if (node.callee.object.type === "Identifier") {
                const obj = node.callee.object.name.toUpperCase();
                const prop = node.callee.property.name.toUpperCase();
                
                if (obj === "BUS" && prop === "SEND") {
                    this.emit(`  BUS_SEND`);
                } 
                else if (obj === "MATH") {
                    if (prop === "MAX") this.emit(`  MAX`);
                    else if (prop === "MIN") this.emit(`  MIN`);
                    else if (prop === "ABS") this.emit(`  ABS`);
                    else if (prop === "RANDOM") this.emit(`  RANDOM`);
                }
                else {
                    this.emit(`  ${obj}_${prop}`);
                }
            } else {
                this.emit(`  ( COMPLEX CALL EXPRESSION NOT SUPPORTED ) DROP`);
            }
        }
        break;

      case "BinaryExpression":
        // Handle Go-like Channel Send: chan <- [op, p1, p2, p3]
        // Acorn parses this as: chan < -[array]
        if (node.operator === "<" && node.right.type === "UnaryExpression" && node.right.operator === "-") {
            this.compileChannelSend(node.left, node.right.argument);
            return;
        }

        this.compileNode(node.left);
        this.compileNode(node.right);
        const opMap: Record<string, string> = {
            "+": "+", "-": "-", "*": "*", "/": "/",
            "%": "MOD", "==": "=", "!=": "<>",
            ">": ">", "<": "<", ">=": ">=", "<=": "<=",
            "&": "AND", "|": "OR", "^": "XOR",
            "<<": "LSHIFT", ">>": "RSHIFT", ">>>": "RSHIFT"
        };
        this.emit(`  ${opMap[node.operator] || "UNKNOWN_OP"}`);
        break;

      case "Identifier":
        const upName = node.name.toUpperCase();
        
        // 1. Loop Variable (I, J)
        const loopIdx = this.loopVars.lastIndexOf(upName);
        if (loopIdx !== -1) {
            const depth = this.loopVars.length - 1 - loopIdx;
            if (depth === 0) this.emit(`  I`);
            else if (depth === 1) this.emit(`  J`);
            else this.emit(`  ( ERROR: Nested loops > 2 )`);
            return;
        }

        // 2. Local Variable or Argument
        if (this.currentScope && (this.currentScope.args.includes(upName) || this.currentScope.variables.has(upName))) {
             const varName = this.resolveVar(node.name);
             if (this.isStructArray(node.name)) {
                 this.emit(`  ${varName}`);
             } else {
                 this.emit(`  ${varName} @`);
             }
             return;
        }

        // 3. Top-Level Variable (Automatic Dereference)
        if (this.globalVars.has(upName)) {
            if (this.isStructArray(node.name)) {
                this.emit(`  ${upName}`);
            } else {
                this.emit(`  ${upName} @`);
            }
            return;
        }

        // 4. Known Global Variable (Automatic Dereference)
        if (KNOWN_VARIABLES.has(upName)) {
            this.emit(`  ${upName} @`);
            return;
        }

        // 5. Known Global Constant (No Dereference)
        if (KNOWN_CONSTANTS.has(upName)) {
            this.emit(`  ${upName}`);
            return;
        }

        // 4. Default: Constant or Function Pointer or Register Name (Address)
        this.emit(`  ${upName}`);
        break;

      case "Literal":
        if (typeof node.value === "string") {
            this.emit(`  S" ${node.value}"`);
        } else if (typeof node.value === "boolean") {
            this.emit(node.value ? `  -1` : `  0`);
        } else if (typeof node.value === "number") {
            this.emit(`  ${node.value}`);
        } else {
            this.emit(`  ${node.raw}`);
        }
        break;

      case "IfStatement":
        this.emitTrace(node);
        this.compileNode(node.test);
        this.emit(`  IF`);
        this.compileNode(node.consequent);
        if (node.alternate) {
            this.emit(`  ELSE`);
            this.compileNode(node.alternate);
        }
        this.emit(`  THEN`);
        break;
        
      case "ReturnStatement":
        this.emitTrace(node);
        if (node.argument) {
            this.compileNode(node.argument);
        }
        if (this.currentScope) {
            this.emitGCForScope(!!node.argument);
        }
        this.emit(`  EXIT`);
        break;

      case "SwitchStatement":
        this.emitTrace(node);
        // Compile the discriminant (expression to switch on)
        this.compileNode(node.discriminant);

        let casesEmitted = 0;
        let hasDefault = false;
        node.cases.forEach((c: any) => {
            if (c.test) {
                // It's a specific case
                this.emit(`  DUP`);
                this.compileNode(c.test);
                this.emit(`  = IF`);
                c.consequent.forEach((stmt: any) => {
                    if (stmt.type !== "BreakStatement") {
                        this.compileNode(stmt);
                    }
                });
                this.emit(`  ELSE`);
                casesEmitted++;
            } else {
                // It's the default case
                hasDefault = true;
                c.consequent.forEach((stmt: any) => {
                    if (stmt.type !== "BreakStatement") {
                        this.compileNode(stmt);
                    }
                });
            }
        });

        // Close all ELSE blocks
        for (let i = 0; i < casesEmitted; i++) {
            this.emit(`  THEN`);
        }

        // Drop the discriminant from the stack
        this.emit(`  DROP`);
        break;

      case "NewExpression":
        if (node.arguments.length > 0) {
            this.compileNode(node.arguments[0]);
        } else {
            this.emit(`  0`);
        }
        return;

      default:
        const msg = `UNHANDLED AST: ${node.type}`;
        this.emit(`  ( ERROR: ${msg} )`);
        console.error(`[AetherTranspiler] ${msg}`, node);
    }
  }

  private static isByteType(name: string): boolean {
      const resolved = this.resolveVar(name);
      return this.varTypes.get(resolved) === "Uint8Array";
  }

  private static getStructType(name: string): string | null {
      const resolved = this.resolveVar(name);
      const type = this.varTypes.get(resolved);
      if (type && type.startsWith("struct ")) {
          return type.substring(7);
      }
      return null;
  }

  private static isStructArray(name: string): boolean {
      const resolved = this.resolveVar(name);
      return this.structArrayCounts.has(resolved);
  }

  private static getExpressionStructType(node: ASTNode): string | null {
      if (!node) return null;
      if (node.type === "Identifier") {
          return this.getStructType(node.name);
      }
      if (node.type === "MemberExpression") {
          if (node.computed) {
              return this.getExpressionStructType(node.object);
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

  /** [AJS-CHANNELS] Compiles a channel send operation (chan.send([...] or chan <- [...]) */
  private static compileChannelSend(target: any, argsNode: any) {
      if (argsNode.type !== "ArrayExpression") {
          this.emit(`  ( ERROR: Channel send expects array [op, p1, p2, p3] )`);
          return;
      }

      const elements = argsNode.elements;
      // BUS_SEND expects: op sender target p1 p2 p3
      this.compileNode(elements[0] || { type: "Literal", value: 0 }); // op
      this.emit(`  MY_ID @ ( Sender )`);
      if (typeof target === "number") {
          this.emit(`  ${target} ( Target Channel )`);
      } else {
          this.compileNode(target);
      }
      this.compileNode(elements[1] || { type: "Literal", value: 0 }); // p1
      this.compileNode(elements[2] || { type: "Literal", value: 0 }); // p2
      this.compileNode(elements[3] || { type: "Literal", value: 0 }); // p3
      this.emit(`  BUS_SEND`);
  }

  /** [AJS-CHANNELS] Emits code within HANDLE_EVENTS to dispatch channel messages to registered callbacks */
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

              if (scope && scope.args.length === 5) {
                  // [AJS-CHANNELS] Modern 5-arg callback: opcode, sender, p1, p2, p3
                  this.emit(`  M_OP @ M_SENDER @ M_P1 @ M_P2 @ M_P3 @ ${forthName}`);
              } else if (scope && scope.args.length === 4) {
                  // [AJS-CHANNELS] Mixed 4-arg callback: opcode, p1, p2, p3
                  this.emit(`  M_OP @ M_P1 @ M_P2 @ M_P3 @ ${forthName}`);
              } else if (scope && scope.args.length === 3) {
                  // [AJS-CHANNELS] Standard 3-arg callback: p1, p2, p3
                  this.emit(`  M_P1 @ M_P2 @ M_P3 @ ${forthName}`);
              } else {
                  this.emit(`  ${forthName}`);
              }
          }
          this.emit(`  THEN`);
      });
  }

  /** [AJS-CHANNELS] Emits the AJS_INIT_CHANNELS word which sends SUB packets for all registered channels */
  private static emitSubscriptionWord() {
      this.emit("\n: AJS_INIT_CHANNELS");
      // [AJS-CHANNELS] Avoid complex logic in this word to ensure it works across all Forth environments
      this.channelSubscriptions.forEach((_, hash) => {
          this.emit(`  SYS_CHAN_SUB MY_ID @ K_HOST 0 ${hash} 0 BUS_SEND`);
      });
      this.emit(";");
  }

  private static emitGCForScope(hasReturnValue: boolean = false) {
       if (!this.currentScope) return;

       let hasDynamicArrays = false;
       this.currentScope.variables.forEach((v) => {
           const fullName = this.sanitizeName(`LV_${this.currentScope!.functionName}_${v}`);
           if (this.varTypes.get(fullName) === "DynamicArray") hasDynamicArrays = true;
       });

       if (!hasDynamicArrays) return;

       if (hasReturnValue) {
           // We are in compile mode, so we just emit instructions.
           this.emit(`  TEMP_VSO_BUFFER ! ( Save return value for GC )`);
       }

       // Loop vars
       this.currentScope.variables.forEach((v) => {
           const fullName = this.sanitizeName(`LV_${this.currentScope!.functionName}_${v}`);
           if (this.varTypes.get(fullName) === "DynamicArray") {
                // Free the chunks properly without leaving residue on stack
                // Use IF ... THEN properly within compiled code
                this.emit(`  ${fullName} @ DUP 0> IF`); // if head_ptr > 0
                this.emit(`    DUP @ SWAP 4 + @ FREE_CHUNKS`); // head tail FREE_CHUNKS
                this.emit(`  ELSE DROP THEN`);
           }
       });

       if (hasReturnValue) {
           this.emit(`  TEMP_VSO_BUFFER @ ( Restore return value )`);
       }
  }

  private static sanitizeName(name: string): string {
      if (name.length <= 31) return name;
      // Deterministic hash for long names
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash) + name.charCodeAt(i);
          hash |= 0;
      }
      const suffix = Math.abs(hash).toString(36).toUpperCase();
      return name.substring(0, 31 - suffix.length - 1) + "_" + suffix;
  }

  private static resolveVar(name: string): string {
    const upName = name.toUpperCase();
    if (this.currentScope) {
        if (this.currentScope.args.includes(upName) || this.currentScope.variables.has(upName)) {
            return this.sanitizeName(`LV_${this.currentScope.functionName}_${upName}`);
        }
    }
    return this.sanitizeName(upName);
  }

  private static emit(str: string) {
    this.output.push(str);
  }
}
