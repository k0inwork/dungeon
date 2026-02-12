
# AETHELGARD ENGINE: SYSTEM ARCHITECTURE (v3.1)

> **Status:** IMPLEMENTED
> **Context:** Hybrid Runtime (React Host + Wasm Kernels).
> **Philosophy:** "The Host is the Router. The Kernels are the Truth."

---

## 1. THE TOPOLOGY: STAR NETWORK

The engine operates on a **Star Topology** where the JavaScript Host (`index.tsx`) acts as the central Router/Scheduler, and independent WAForth instances act as specialized Processing Nodes (Kernels).

```mermaid
graph TD
    HOST[JavaScript Host (React)]
    
    HOST <-->|Input/Output Bus| GRID[GRID Kernel (Physics)]
    HOST <-->|Input/Output Bus| HIVE[HIVE Kernel (AI)]
    HOST <-->|Input/Output Bus| PLAYER[PLAYER Kernel (Client)]
```

### 1.1 The Kernels
1.  **GRID (Physics Server):** Owns the Map (`VRAM`), Collision Logic, and Environmental Rules. It is the "Source of Truth" for where things are.
2.  **HIVE (AI Brain):** Owns the decision-making logic for NPCs. It reads the world state via events and sends `REQ_MOVE` commands.
3.  **PLAYER (Client Proxy):** Owns the Player's Inventory, Stats, and parses Raw Input (Keys) into Intent (Commands).

---

## 2. THE COMPILATION LAYER (AetherJS)

**New in v3.1:** To solve the complexity of writing raw Forth, we introduce the **AetherScript Transpiler**.

*   **Source:** `.ajs` (AetherJS) files.
*   **Format:** Strict subset of JavaScript.
*   **Compilation:** Transpiled to Forth at Runtime by `AetherTranspiler.ts`.
*   **Execution:** Wasm Kernel interprets the generated Forth.

### 2.1 Code Flow
1.  **AI/Dev:** Writes `function onCollide(id) { Bus.send(CMD_DAMAGE, ...); }`.
2.  **Transpiler:** Converts to `: ON_COLLIDE { id -- } ... BUS_SEND ;`.
3.  **WAForth:** Compiles definition to Wasm Bytecode.

---

## 3. THE UNIFIED SIMULATION TICKER

The **Ticker** (`tickSimulation` in `index.tsx`) is the heartbeat of the engine. It is responsible for synchronizing time and data between the asynchronous kernels.

The Ticker runs in two modes depending on the active **Manifold**:

| Manifold | Mode | Trigger | Description |
| :--- | :--- | :--- | :--- |
| **GRID** (Roguelike) | **Event-Driven** | `Player Input` | The Ticker runs once per user keypress. This creates a "My Turn, Your Turn" cadence. |
| **PLATFORM** (Real-Time) | **Time-Driven** | `setInterval` | The Ticker runs automatically every ~100ms. NPCs move independently of the player. |

### 3.1 The Tick Cycle
Every time the Ticker fires, exactly one "World Step" occurs:

1.  **Harvest (Output -> Router):** The Host reads the `OUTPUT_QUEUE` of every Kernel.
2.  **Route (Router -> Input):** The Host moves packets to the target Kernel's `INPUT_QUEUE`. (e.g., Hive sends `REQ_MOVE` -> Host routes to Grid Input).
3.  **Process (Input -> Logic):** The Host commands every Kernel to `PROCESS_INBOX`.
4.  **Cycle (Logic -> State):**
    *   **Hive:** `RUN_HIVE_CYCLE` (NPCs decide moves).
    *   **Grid:** `RUN_ENV_CYCLE` (Fire spreads, traps trigger).

---

## 4. THE DATA BUS (AIKP Protocol)

Communication is handled via the **Aethelgard Inter-Kernel Protocol (AIKP)**.
There is no shared object memory. Kernels communicate exclusively by passing 24-byte packets.

### 4.1 Memory Layout
Every Kernel has a standardized linear memory region:

*   `0x00400 - 0x10400`: **INPUT QUEUE** (Read-Only for Kernel).
*   `0x10400 - 0x20400`: **OUTPUT QUEUE** (Write-Only for Kernel).

### 4.2 Packet Structure
A packet consists of 6 Integers (32-bit):
`[ OPCODE | SENDER | TARGET | PAYLOAD_1 | PAYLOAD_2 | PAYLOAD_3 ]`

### 4.3 Example Flow: The NPC Move
1.  **Tick Start:** `tickSimulation()` begins.
2.  **HIVE Kernel:** Decides Entity #5 should move North.
    *   Writes `[ REQ_MOVE, K_HIVE, K_GRID, 5, 0, -1 ]` to Output.
3.  **HOST Router:**
    *   Reads Output.
    *   Sees Target is `K_GRID` (Physics).
    *   Pushes packet to GRID's Input Queue.
4.  **GRID Kernel:**
    *   Runs `PROCESS_INBOX`.
    *   Reads `REQ_MOVE`. Checks collision at `(X, Y-1)`.
    *   **Success:** Updates Entity #5 position. Writes `[ EVT_MOVED, K_GRID, K_HIVE, 5, X, Y-1 ]` to Output.
    *   **Failure:** Writes `[ EVT_COLLIDE, ... ]`.
5.  **Tick End:** The frame is rendered.

---

## 5. RENDERING ARCHITECTURE

The Host does not ask "Where is the Goblin?". It asks "What does the screen look like?".

### 5.1 Shared VRAM
The **GRID Kernel** maintains a visualization buffer at `0x80000`.
*   **Format:** `Uint32` array representing the grid.
*   **Data:** `0x00RRGGBB` (Color) | `0xCC` (ASCII Char).

### 5.2 The Render Loop
The `TerminalCanvas` component runs on `requestAnimationFrame` (60 FPS), independent of the Simulation Ticker.
*   It grabs the `ArrayBuffer` slice from Wasm Memory.
*   It iterates the integers and draws them to the HTML5 Canvas.
*   **Benefit:** Zero-copy rendering. The Logic runs at 10Hz (or User Speed), but the Render runs at 60Hz.
