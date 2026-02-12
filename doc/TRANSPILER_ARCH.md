# AETHER SCRIPT TRANSPILER ARCHITECTURE (v0.7)

> **Role:** The Babel Fish. Converts High-Level AI Intent (**AetherJS/AetherPy**) into Low-Level Physics (Forth).
> **Constraint:** Forth logic is stack-based and globally scoped.

---

## 1. THE SCOPING STRATEGY (AI-Native)

**Correction from v0.5:**
We do not use a complex "Mangling" algorithm in the Transpiler.
Instead, we enforce **AI-Native Scoping**.

### 1.1 The Rule
The AI is instructed to namespace its own variables.

*   **Context:** `SKILL_FIREBALL`
*   **Bad Code:** `let radius = 10;` (Generic name, dangerous).
*   **Good Code:** `let fireball_radius = 10;` (Explicit namespace).

---

## 2. THE POLYGLOT MAPPER

The Transpiler accepts a subset of JS (AetherJS) and Python (AetherPy). It normalizes both into a shared Abstract Syntax Tree (AST) before emitting Forth.

### 2.1 Arithmetic & Logic

| Operation | AetherJS | AetherPy | Forth RPN |
| :--- | :--- | :--- | :--- |
| **Add** | `a + b` | `a + b` | `A @ B @ +` |
| **Multiply** | `a * b` | `a * b` | `A @ B @ *` |
| **Access** | `ptr[i]` | `ptr[i]` | `PTR @ I @ CELLS + @` |
| **Assign** | `ptr[i] = v` | `ptr[i] = v` | `V @ PTR @ I @ CELLS + !` |

### 2.2 Control Flow

**If / Else:**
*   **AetherJS:** `if (x > 5) { a() } else { b() }`
*   **Forth:** `X @ 5 > IF A ELSE B THEN`

**While Loop:**
*   **AetherJS:** `while (x > 0) { x--; }`
*   **Forth:** `BEGIN X @ 0 > WHILE -1 X +! REPEAT`

**For Loop (Range):**
*   **AetherJS:** `for (let i = 0; i < 10; i++) { Log(i); }`
*   **Transpiler Logic:**
    1.  Push Limit (`10`).
    2.  Push Start (`0`).
    3.  Emit `DO`.
    4.  Map identifier `i` to Forth word `I`.
    5.  Emit Body.
    6.  Emit `LOOP`.
*   **Forth:** `10 0 DO I LOG LOOP`

---

## 3. THE KINETIC API (The Prism)

The Transpiler maps high-level function calls to the specific Vector Verbs.

### 3.1 Real Damage (HP)
*   **AetherJS:** `Damage(Target, 10, TYPE_FIRE)`
*   **Forth:** `10 TYPE_FIRE TARGET @ RESOLVE_DAMAGE`
*   **Note:** `TYPE_FIRE` is an integer constant resolved during compilation.

### 3.2 Temporal Damage (AP)
*   **AetherJS:** `Stun(Target, 50)`
*   **Forth:** `50 TARGET @ APPLY_STUN`

### 3.3 Spatial Damage (Coords)
*   **AetherJS:** `Push(Target, 3)`
*   **Forth:** `3 CASTER_FACING @ TARGET @ APPLY_FORCE`
*   **AetherJS:** `Teleport(Self, 10, 10)`
*   **Forth:** `10 10 SELF @ TELEPORT_ENTITY`

---

## 4. STRING HANDLING (The Wrapper Protocol)

**Problem:** Standard Forth `S" ..."` is often restricted to Compile Mode.
**Solution:** All string literals are hoisted into their own dedicated "Wrapper Words" before the main logic.

**Protocol:**
1.  **Scan:** Find string literal `"Critical Hit!"`.
2.  **Mangling:** Create unique ID `STR_SKILL_104_0`.
3.  **Definition:** Emit `: STR_SKILL_104_0 S" Critical Hit!" ;`.
4.  **Substitution:** Replace `"Critical Hit!"` in the AST with `STR_SKILL_104_0`.

---

## 5. DIAGNOSTIC MODE (For Validation)

When running in `VALIDATION` mode (Phase 6), the Transpiler does not emit Forth. Instead, it emits a `ValidationResult`.

### 5.1 AST Analysis
The AST walker checks every `CallExpression`.
*   **Logic:** `if (!API_WHITELIST.includes(node.callee.name))`
*   **Result:** Pushes `ERR_HALLUCINATION` to result array.

### 5.2 Variable Tracking
The walker checks variable names against the Context ID.
*   **Logic:** `if (!variableName.startsWith(contextPrefix))`
*   **Result:** Pushes `ERR_SCOPE` to result array.
