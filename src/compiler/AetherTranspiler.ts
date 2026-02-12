
import * as acorn from "acorn";

// --- TYPES ---
interface ASTNode {
  type: string;
  [key: string]: any;
}

interface Scope {
  functionName: string;
  variables: Set<string>;
  args: string[];
}

interface StructDef {
    name: string;
    fields: Map<string, number>; // FieldName -> ByteOffset
    size: number;
}

// Variables that are defined as VARIABLE in Forth and must be fetched (@) when used as R-values
const KNOWN_GLOBALS = new Set([
  "ENTITY_COUNT", "HIVE_ENT_COUNT", "RNG_SEED",
  "PLAYER_HP", "PLAYER_GOLD",
  "M_OP", "M_SENDER", "M_TARGET", "M_P1", "M_P2", "M_P3",
  "OUT_PTR"
]);

export class AetherTranspiler {
  private static scopes: Scope[] = [];
  private static currentScope: Scope | null = null;
  private static output: string[] = [];
  private static loopVars: string[] = []; // Stack of active loop variables for I/J mapping
  private static structs: Map<string, StructDef> = new Map();
  // Global map of ALL field names to offsets (Simplification: assumes unique fields globally or shared layout)
  private static globalFieldOffsets: Map<string, number> = new Map();

  static transpile(jsCode: string): string {
    this.scopes = [];
    this.output = [];
    this.currentScope = null;
    this.loopVars = [];
    this.structs = new Map();
    this.globalFieldOffsets = new Map();

    if (!jsCode || !jsCode.trim()) {
        return "";
    }

    // Pre-Process Struct Definitions (ACORN doesn't handle "struct")
    // Syntax: struct Name { field1, field2 }
    const processedCode = this.extractStructs(jsCode);

    try {
      const ast = acorn.parse(processedCode, { ecmaVersion: 2020 });
      this.emitStructs();
      this.analyzeScopes(ast as ASTNode);
      this.emitGlobals();
      this.compileNode(ast as ASTNode);
      return this.output.join("\n");
    } catch (e: any) {
      console.error("Transpilation Failed:", e);
      return `( ERROR: ${e.message} )`;
    }
  }

  private static extractStructs(code: string): string {
      const structRegex = /struct\s+(\w+)\s*\{\s*([^}]+)\s*\}/g;
      let match;
      
      // We remove the structs from JS code so Acorn handles the rest, 
      // but we parse them to build offsets.
      let cleanCode = code;

      while ((match = structRegex.exec(code)) !== null) {
          const name = match[1];
          const fieldsStr = match[2];
          const fields = fieldsStr.split(',').map(s => s.trim()).filter(s => s);
          
          const def: StructDef = {
              name,
              fields: new Map(),
              size: fields.length * 4
          };

          fields.forEach((f, i) => {
              const offset = i * 4;
              def.fields.set(f, offset);
              this.globalFieldOffsets.set(f, offset);
          });
          
          this.structs.set(name, def);
          
          // Remove from source code to avoid parse error
          cleanCode = cleanCode.replace(match[0], "");
      }
      return cleanCode;
  }

  private static emitStructs() {
      if (this.structs.size === 0) return;
      this.emit("( --- STRUCT OFFSETS --- )");
      this.structs.forEach(def => {
          this.emit(`( Struct: ${def.name} )`);
          this.emit(`${def.size} CONSTANT SIZEOF_${def.name.toUpperCase()}`);
          def.fields.forEach((offset, fieldName) => {
              this.emit(`${offset} CONSTANT OFF_${fieldName.toUpperCase()}`);
          });
      });
      this.emit("( --------------------- )");
  }

  // --- PASS 1: ANALYSIS ---
  private static analyzeScopes(node: ASTNode) {
    if (node.type === "FunctionDeclaration") {
      const funcName = node.id.name.toUpperCase();
      const args = node.params.map((p: any) => p.name.toUpperCase());
      
      const scope: Scope = {
        functionName: funcName,
        variables: new Set(),
        args: args
      };
      
      this.findVariables(node.body, scope);
      this.scopes.push(scope);
    }
    
    if (node.body && Array.isArray(node.body)) {
      node.body.forEach((child: any) => this.analyzeScopes(child));
    }
  }

  private static findVariables(node: ASTNode, scope: Scope) {
    if (!node) return;
    
    if (node.type === "VariableDeclaration") {
      node.declarations.forEach((decl: any) => {
        scope.variables.add(decl.id.name.toUpperCase());
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
    this.scopes.forEach(scope => {
      scope.args.forEach(arg => {
        this.emit(`VARIABLE LV_${scope.functionName}_${arg}`);
      });
      scope.variables.forEach(v => {
        this.emit(`VARIABLE LV_${scope.functionName}_${v}`);
      });
    });
    this.emit("( ------------------------- )");
  }

  // --- PASS 2: COMPILATION ---
  private static compileNode(node: ASTNode) {
    switch (node.type) {
      case "Program":
        node.body.forEach((n: any) => this.compileNode(n));
        break;

      case "FunctionDeclaration":
        const name = node.id.name.toUpperCase();
        const scope = this.scopes.find(s => s.functionName === name);
        this.currentScope = scope || null;
        
        this.emit(`\n: ${name} ( ${scope?.args.join(' ')} -- )`);
        
        if (scope && scope.args.length > 0) {
            [...scope.args].reverse().forEach(arg => {
                this.emit(`  LV_${name}_${arg} !`);
            });
        }
        
        this.compileNode(node.body);
        
        this.emit(`;`);
        this.currentScope = null;
        break;

      case "BlockStatement":
        node.body.forEach((n: any) => this.compileNode(n));
        break;

      case "VariableDeclaration":
        node.declarations.forEach((decl: any) => {
           if (decl.init) {
               this.compileNode(decl.init);
               const varName = this.resolveVar(decl.id.name);
               this.emit(`  ${varName} !`);
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
        let loopVarName = "";
        let isSupported = false;

        if (node.init && node.init.type === 'VariableDeclaration' && node.init.declarations.length === 1) {
            loopVarName = node.init.declarations[0].id.name;
            const startVal = node.init.declarations[0].init;
            
            if (node.test && node.test.type === 'BinaryExpression' && node.test.operator === '<' && node.test.left.name === loopVarName) {
                 const endVal = node.test.right;

                 if (node.update && node.update.type === 'UpdateExpression' && node.update.operator === '++' && node.update.argument.name === loopVarName) {
                     isSupported = true;
                     this.compileNode(endVal);   // Limit
                     this.compileNode(startVal); // Start
                     this.emit(`  DO`);
                     
                     this.loopVars.push(loopVarName.toUpperCase());
                     this.compileNode(node.body);
                     this.loopVars.pop();
                     
                     this.emit(`  LOOP`);
                 }
            }
        }

        if (!isSupported) {
            this.emit(`  ( ERROR: Only simple 'for(let i=0; i<N; i++)' loops supported )`);
        }
        break;

      // --- LOGIC ---
      
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
        // i++ -> 1 i +!
        if (node.argument.type === "Identifier") {
            const varName = this.resolveVar(node.argument.name); // returns Name
            const val = node.operator === "++" ? "1" : "-1";
            this.emit(`  ${val} ${varName} +!`);
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
            const offset = this.globalFieldOffsets.get(propName);
            const offConst = `OFF_${propName.toUpperCase()}`;
            
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
            
            if (node.operator === "=") {
                this.emit(`  CELLS + !`); // Calc offset and Store
            } else if (node.operator === "+=") {
                this.emit(`  CELLS + +!`); // Add to value at addr
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
            this.emit(`  CELLS + @`); // Calc offset and Fetch
        } 
        else if (!node.computed) {
             // HANDLE STRUCT READ: ent.hp
             const propName = node.property.name;
             const offset = this.globalFieldOffsets.get(propName);
             if (offset !== undefined) {
                 this.compileNode(node.object); // Ptr
                 this.emit(`  OFF_${propName.toUpperCase()} + @`);
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
        node.arguments.forEach((arg: any) => {
            this.compileNode(arg);
        });

        if (node.callee.type === "Identifier") {
            const func = node.callee.name.toUpperCase();
            if (func === "PEEK") this.emit(`  @`);
            else if (func === "POKE") this.emit(`  !`);
            else if (func === "CPEEK") this.emit(`  C@`);
            else if (func === "CPOKE") this.emit(`  C!`);
            else if (func === "LOG") {
                const arg0 = node.arguments[0];
                if (arg0 && arg0.type === "Literal" && typeof arg0.value === "string") {
                    this.emit(`  S.`);
                } else {
                    this.emit(`  .N`);
                }
            }
            else this.emit(`  ${func}`);
        } 
        else if (node.callee.type === "MemberExpression") {
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
             this.emit(`  ${varName} @`);
             return;
        }

        // 3. Known Global Variable (Automatic Dereference)
        if (KNOWN_GLOBALS.has(upName)) {
            this.emit(`  ${upName} @`);
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
        } else {
            this.emit(`  ${node.raw}`);
        }
        break;

      case "IfStatement":
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
        if (node.argument) this.compileNode(node.argument);
        this.emit(`  EXIT`);
        break;

      default:
        this.emit(`  ( UNHANDLED AST: ${node.type} )`);
    }
  }

  private static resolveVar(name: string): string {
    const upName = name.toUpperCase();
    if (this.currentScope) {
        if (this.currentScope.args.includes(upName) || this.currentScope.variables.has(upName)) {
            return `LV_${this.currentScope.functionName}_${upName}`;
        }
    }
    return upName;
  }

  private static emit(str: string) {
    this.output.push(str);
  }
}
