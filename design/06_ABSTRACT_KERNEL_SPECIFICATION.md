# ABSTRACT KERNEL SPECIFICATION (v1.0)

> **Context:** Non-Spatial Games (Card, Puzzle, Text).
> **Kernel File:** `kernels/logic_core.fs`
> **Concept:** The "Stateless" Executor.

## 1. THE ARCHITECTURE

In Abstract Games, the "Board" is abstract (a UI list, a hand of cards). Managing this in Wasm Linear Memory is unnecessary overhead.

### 1.1 Responsibilities
*   **JavaScript:** The Container. Holds the truth.
*   **Wasm:** The Judge. Decides the outcome of interactions.

## 2. EXECUTION FLOW (Example: Card Game)

1.  **User Action:** Player drags "Fireball Card" (ID: 101) to "Goblin" (ID: 50).
2.  **JS Request:**
    *   Lookup Script for Card 101: `SCRIPT_FIREBALL`.
    *   Call Wasm: `EXECUTE_INTERACTION(SOURCE_PLAYER, TARGET_GOBLIN, SCRIPT_FIREBALL)`.
3.  **Wasm Execution:**
    *   The Kernel sets up the `CTX` (Context).
    *   It runs `SCRIPT_FIREBALL`.
    *   Script: `10 DAMAGE`.
4.  **Wasm Output:**
    *   Pushes `EVT_DAMAGE { target: 50, amount: 10 }` to Queue.
5.  **JS Resolution:**
    *   Reads event.
    *   Updates Goblin HP in JS State.
    *   Removes Card from Hand.

## 3. THE GENERIC LOGIC KERNEL (`logic_core.fs`)

This kernel is much simpler than the Grid kernel. It basically just implements the API Verbs.

```forth
\ Generic Logic Core

\ Memory Mapped Input Registers
0x20000 CONSTANT REG_SOURCE_ID
0x20004 CONSTANT REG_TARGET_ID
0x20008 CONSTANT REG_RNG_SEED

\ API Verbs
: DAMAGE ( amount -- )
  \ Just pushes the event. Does not modify internal state (because there is none).
  REG_TARGET_ID @  ( target )
  SWAP             ( amount )
  EVT_DAMAGE       ( event_id )
  PUSH_EVENT
;

: HEAL ( amount -- )
  REG_TARGET_ID @ SWAP EVT_HEAL PUSH_EVENT
;

: DRAW_CARDS ( count -- )
  EVT_DRAW_CARDS PUSH_EVENT
;

: ADD_RESOURCE ( amount resource_id -- )
  SWAP EVT_ADD_RESOURCE PUSH_EVENT
;
```

## 4. WHY USE WASM AT ALL?

If JS holds the state, why not run the script in JS?

1.  **Safety:** We are running AI-generated code. We do not want to `eval()` it in the main thread with full access to the `window` object or network. Wasm is a sandbox.
2.  **Portability:** The same "Fireball" script (Forth bytecode) works in the 3D FPS mode, the 2D Grid mode, and the Card Game mode. The *implementation* of the `DAMAGE` word changes, but the *script* remains identical.
3.  **Determinism:** Wasm math is strictly deterministic across browsers. Important for validating replays or competitive seeds.
