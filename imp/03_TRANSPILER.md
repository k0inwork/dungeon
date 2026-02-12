# IMPLEMENTATION PHASE 3: THE TRANSPILER

## 1. OBJECTIVE
Convert AI-generated JavaScript (AetherJS) into Forth source code compatible with our Kernel.

## 2. DEPENDENCIES
*   `acorn`: A tiny, fast JavaScript parser to generate an AST (Abstract Syntax Tree).

## 3. STEPS

### 3.1 AST Parsing
Create `src/compiler/Parser.ts`.
```typescript
import * as acorn from 'acorn';
export const parse = (code: string) => acorn.parse(code, { ecmaVersion: 2020 });
```

### 3.2 The AST Walker
Create `src/compiler/Walker.ts`.
Implement a recursive function `visit(node)` that emits Forth string fragments.

#### Mappings:
*   `BinaryExpression (+)`: `visit(left); visit(right); emit("+");`
*   `CallExpression (Damage)`: 
    *   `visit(args[0]); // Target`
    *   `visit(args[1]); // Amount`
    *   `visit(args[2]); // Type`
    *   `emit("CMD_DAMAGE");`
*   `IfStatement`:
    *   `visit(test);`
    *   `emit("IF");`
    *   `visit(consequent);`
    *   `emit("THEN");`

### 3.3 The Validator (Crucible)
Create `src/compiler/Validator.ts`.
*   Check identifiers against `API_WHITELIST`.
*   Check strict scoping (no global variables unless via `SetFlag`).
*   Throw descriptive errors for the UI to display.

### 3.4 Integration
Expose a main function:
`compile(scriptName: string, jsCode: string): string`
Output format: `: scriptName ...ForthCode... ;`
