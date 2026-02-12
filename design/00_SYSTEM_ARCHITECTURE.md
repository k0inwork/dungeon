# SYSTEM ARCHITECTURE: THE HYBRID MODEL (v4.3)

> **Status:** APPROVED DESIGN
> **Context:** Browser-Only Runtime.
> **Runtime:** `waforth` (Standard Binary).

## 1. HIGH LEVEL OVERVIEW

### 1.1 The Runtime Registry
1.  **`waforth` (The Engine):**
    *   We use the stock `waforth` instance.
    *   It provides the memory and the interpreter.
    
2.  **`kernels/*.fs` (The Cartridges):**
    *   These are text files loaded via `fetch()` and injected into WAForth.
    *   **`grid_core.fs`:** Turn-Based Dungeon Logic.
    *   **`hex_core.fs`:** Turn-Based Wargame Logic.
    *   **`card_core.fs`:** Deck/Hand Logic.
    *   **`math_core.fs`:** Incremental/Idle Logic.

3.  **`Engine_Gravity.ts` (The Platformer):**
    *   **Runtime:** Pure TypeScript (Host).
    *   **Reason:** Real-Time physics (60fps) is better handled in JS than bridging Wasm 60 times a second.

---

## 2. THE BOOT PROCESS

1.  **Initialize:** `const forth = new WAForth(); await forth.load();`
2.  **Bind:** `forth.bind("JS_LOG", (p) => ...);`
3.  **Load Kernel:** 
    ```typescript
    // React determines which Kernel to load based on the Node Type
    const kernelFile = currentNode.kernelType === 'DECK' ? 'kernels/card_core.fs' : 'kernels/grid_core.fs';
    const kernelSource = await fetch(kernelFile).then(r => r.text());
    forth.interpret(kernelSource);
    ```
4.  **Load Content:**
    ```typescript
    const contentSource = Transpiler.emit(ai_json);
    forth.interpret(contentSource);
    ```
5.  **Start:** `forth.interpret("START_GAME");`

---

## 3. THE DATA FLOW (Double-Queue)
Remains consistent across *all* Wasm kernels.
*   **Inbox:** Host writes to `INPUT_QUEUE` (Linear Memory).
    *   *Grid:* `CMD_MOVE_EAST`
    *   *Deck:* `CMD_PLAY_CARD_INDEX_0`
*   **Processing:** Host calls `forth.interpret("PROCESS_INBOX")`.
*   **Outbox:** Guest writes to `OUTPUT_QUEUE`. Host reads buffer.

---

## 4. SCHEDULING
*   **Platformer (JS):** `requestAnimationFrame`.
*   **Simulation (Wasm):** `async` function triggered by User Input or Tick Timer.
