
# MIGRATION ANALYSIS: FORTH KERNELS TO AETHERJS (v1.0)

> **Objective:** Replace manual Forth coding (`.fs`) with a constrained JavaScript subset (`.ajs`) that transpiles to Forth at runtime.
> **Driver:** AI Generation capability, Code Readability, Debugging speed.

---

## 1. COMPARATIVE ANALYSIS

| Feature | Current State (Raw Forth) | Proposed State (AetherJS) | Impact |
| :--- | :--- | :--- | :--- |
| **Cognitive Load** | **Extreme.** Requires visualizing the stack (`n1 n2 -- n2`). Off-by-one errors crash the kernel. | **Low.** Standard variable naming (`let x = 10`). Familiar syntax. | Developers/AI can write logic 10x faster. |
| **AI Generation** | **Poor.** LLMs often hallucinate Forth words or lose track of stack depth. | **Excellent.** LLMs are highly optimized for JavaScript/TypeScript syntax. | Generative content becomes reliable. |
| **Debugging** | **Hard.** `undefined word` or silent stack underflows. | **Medium.** The Transpiler can catch scope errors and type mismatches *before* execution. | Compilation errors are human-readable. |
| **Performance** | **Native.** No overhead. | **Near-Native.** 95% efficiency if transpiler uses WAForth Locals efficiently. | Negligible runtime cost for massive logic gains. |
| **Control Flow** | `IF ... ELSE ... THEN`, `BEGIN ... WHILE ... REPEAT` | `if () {}`, `while () {}`, `for () {}` | Nested logic is much easier to read. |

---

## 2. THE ABSTRACTION GAP

The challenge is mapping a **Register Machine** (JS) to a **Stack Machine** (Forth).

### 2.1 Variables vs. The Stack
*   **JS:** `let hp = 100; hp = hp - 10;`
*   **Forth (Global):** `VARIABLE HP  100 HP !  HP @ 10 - HP !`
*   **Forth (Locals):** `{: hp :}` (WAForth Syntax)

**Strategy:** We will use **WAForth Locals** (`{: ... :}`) for function arguments and local variables. This maps `let` directly to a local register, avoiding complex stack juggling.

### 2.2 Memory Access
*   **JS:** `Entities[id].hp`
*   **Forth:** `ID ENT_SIZE * ENT_TABLE + 16 + @`

**Strategy:** We will expose a `Memory` object in AetherJS that maps to Forth pointer arithmetic words.
*   `Memory.read(ptr)` -> `@`
*   `Memory.write(ptr, val)` -> `!`

---

## 3. AETHERJS SYNTAX SPECIFICATION

AetherJS is **Strict Subset** of JavaScript.

### 3.1 Allowed Features
*   **Functions:** `function name(arg1, arg2) { ... }` (Maps to `: NAME { arg1 arg2 -- } ... ;`)
*   **Variables:** `let x = val;` (Maps to locals).
*   **Control:** `if/else`, `while`, `return`.
*   **Math:** `+ - * / % & | ^ >> <<`.
*   **API Calls:** `Bus.send()`, `Log()`.

### 3.2 Forbidden Features
*   **Objects:** No `new Object()`. Use Memory Pointers.
*   **Arrays:** No `[1, 2]`. Use Memory Buffers.
*   **Closures:** No functions inside functions.
*   **Classes:** No OOP. Functional only.

---

## 4. IMPLEMENTATION PLAN

### Phase 1: The Transpiler (The "Babel Fish")
Build `src/compiler/AetherTranspiler.ts`.
*   Input: String (AJS Code).
*   Process: Tokenize -> Abstract Syntax Tree (AST) -> Forth Emitter.
*   Output: String (Forth Code).

### Phase 2: Kernel Rewrite
Rewrite `HiveKernel.ts` first, as it is pure logic (perfect candidate).

**Example Comparison:**

**Current HiveKernel (Forth):**
```forth
: DECIDE_ACTION ( id -- )
  RAND_DIR ROT
  REQ_MOVE K_HIVE K_PHYSICS 3 ROLL 3 ROLL 3 ROLL BUS_SEND
;
```

**New HiveKernel (AetherJS):**
```javascript
function decideAction(id) {
  let dx = Random.dirX();
  let dy = Random.dirY();
  Bus.send(REQ_MOVE, K_HIVE, K_PHYSICS, id, dx, dy);
}
```

### Phase 3: The Build Step
Update `ForthIDE` to allow users to write AetherJS in the editor, and see the Transpiled Forth in a "Preview" pane.
