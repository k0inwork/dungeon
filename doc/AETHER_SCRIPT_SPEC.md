# AETHER SCRIPT SPECIFICATION (v3.0)

> **Purpose:** Guidelines for the "Flesh" (AI) on how to write code that the "Skeleton" (Transpiler) can understand.

## 1. THE LANGUAGE: AETHER JS (Expanded)
We use a **Restricted Subset** of JavaScript that maps efficiently to Forth's stack and memory model.

### 1.1 The Whitelist (What is allowed)
*   **Control Flow:** `if`, `else`, `return`.
*   **Loops:** `for`, `while` (Mapped to `DO...LOOP` and `BEGIN...WHILE`).
*   **Variables:** `let`, `const`.
*   **Types:** `Integer`, `String` (Literals), `Boolean`, `Array` (Typed Pointers).
*   **Math:** `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `>`, `<`.
*   **API Calls:** Functions defined in the Kernel Reference.

### 1.2 The Blacklist (What is FORBIDDEN)
*   **Complex Objects:** `let x = { a: 1, b: 2 }`. *Use Memory Structs instead.*
*   **Closures/Functions:** No defining `function` inside the script.
*   **Native API:** No `Math.random()`, `console.log()`. *Use `Roll()` and `Log()`.*
*   **String Manipulation:** No `str.split()` or regex. Strings are immutable tokens.

---

## 2. LOOPS AND ITERATION

The Transpiler maps standard JS loops to Forth's high-performance hardware loops.

### 2.1 Range Loops (The `DO` Loop)
Used for iterating N times.
*   **JS:** `for (let i = 0; i < 10; i++) { Log(i); }`
*   **Forth:** `10 0 DO I LOG LOOP`
*   **Rule:** The variable *must* be defined in the loop header. The step must be incremental (`i++`).

### 2.2 Condition Loops (The `WHILE` Loop)
Used for state checks.
*   **JS:** `while (GetHP(Target) > 0) { Damage(Target, 1); }`
*   **Forth:** `BEGIN TARGET GET_HP 0 > WHILE 1 TARGET DAMAGE REPEAT`

---

## 3. MEMORY AND ARRAYS

Arrays in AetherScript are **Raw Pointers** to memory blocks.

### 3.1 Allocation
You can allocate a temporary scratch buffer.
*   **JS:** `let stats = Alloc(5);` (Allocates 5 integers).
*   **Forth:** `5 ALLOC_SCRATCH -> stats`

### 3.2 Access (Read/Write)
Standard bracket notation is transpiled to pointer arithmetic.
*   **JS:** `stats[0] = 10;`
*   **Forth:** `10 stats 0 CELLS + !`
*   **JS:** `let val = stats[1];`
*   **Forth:** `stats 1 CELLS + @ -> val`

---

## 4. VARIABLE SCOPING RULES

### 4.1 Script-Local Scope
Variables declared with `let` exist only for the duration of the script execution. They are mapped to Wasm Registers.

```javascript
// Valid
let dmg = 10;
for (let i = 0; i < 3; i++) {
   dmg = dmg + 5;
}
Damage(Target, dmg, TYPE_PHYSICAL);
```

### 4.2 Global Persistence
To persist data between script executions, you **MUST** use the `SetFlag` / `GetFlag` API. You cannot use global variables.

```javascript
// INVALID
global_count = global_count + 1; 

// VALID
let c = GetFlag("count");
SetFlag("count", c + 1);
```

---

## 5. ERROR CODES
If the Transpiler fails, it returns these codes to the AI:
*   **ERR_ILLEGAL_SYNTAX**: Usage of objects or closures.
*   **ERR_UNKNOWN_VERB**: Function not in API Whitelist.
*   **ERR_SCOPE_LEAK**: Variable used without declaration.
*   **ERR_STRING_OP**: Attempted to concatenate or mutate a string.
