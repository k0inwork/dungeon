# AETHELGARD: TESTING STRATEGY (v2.0)

## 1. The Neuro-Symbolic Gap
The biggest risk is the AI generating content that breaks the Game Engine (e.g., negative HP, invalid syntax).

### 1.1 Schema Validation (The Gatekeeper)
*   **Tool:** Zod or pure JSON Schema.
*   **Process:** AI output is parsed -> Validated against strict types -> Rejected if invalid.

### 1.2 "Dry Run" Compilation
Before a generated Skill is assigned to a Class:
1.  Transpile the AI-generated code to Forth.
2.  Spin up a **Temporary WAForth Instance**.
3.  Load the script.
4.  Execute it against a dummy entity.

## 2. Unit Testing (Symbolic)

### 2.1 Forth Unit Tests
*   **File:** `tests/physics.fs`
*   **Example:**
    ```forth
    : TEST_WALL_COLLISION
      0 0 WALL SET_TILE
      0 0 CAN_PASS?
      0 = ASSERT \ Expect False (0)
    ;
    ```

### 2.2 Activation Tests (New)
*   **Scenario:** Spawn 100 entities in a line.
*   **Action:** Move Camera to X=500.
*   **Assert:** Entities at X=0 should have `AWAKE=0`. Entities at X=500 should have `AWAKE=1`.
*   **Perf Check:** Ensure Frame Time stays < 16ms even with 10,000 entities if only 50 are visible.

## 3. UI/UX Testing

### 3.1 The "Observer Mode"
*   An automated script that spawns a level and has the AI play against itself at 100x speed.
*   **Goal:** Detect memory leaks and infinite loops in AI logic (e.g., two NPCs healing each other forever).

### 3.2 Latency Profiling
*   Measure time from "User Action" to "UI Update".
*   Measure overhead of WebLLM inference vs Gemini API.
