# LLM-Driven Dynamic AJS Logic Kernels: Analysis & Proposal

## 1. Architectural Overview & Context
Aethelgard currently employs a unique architecture where game logic is decoupled into isolated instances of WebAssembly Forth (WAForth) acting as "Kernels" (`GridKernel`, `HiveKernel`, `BattleKernel`, `PlayerKernel`). These kernels communicate over a lightweight 24-byte packet bus via the JavaScript host using the AIKP (Aethelgard Inter-Kernel Protocol).

To simplify kernel development, Aethelgard uses **AetherTranspiler** to convert a strict subset of JavaScript (AJS) into Forth. This allows developers to write familiar JS-like syntax (e.g., `BattleKernel.ts`, `GridKernel.ts`) while reaping the benefits of WebAssembly Forth's isolation and speed.

## 2. Benefits of the AJS/Forth Approach

### A. Strict Memory & Logic Isolation
Every kernel runs in its own memory space (WAForth instance). A bug in the `HiveKernel` (AI) cannot corrupt the `GridKernel` (Physics) or the `PlayerKernel` (Inventory/State).

### B. High Performance & Low Latency
Once compiled to WebAssembly Forth, the execution of pure logic (combat resolution, pathfinding, collisions) is extremely fast. Memory operations are reduced to basic pointers, array indices, and byte-level manipulation without the overhead of JavaScript garbage collection.

### C. Determinism & Hibernation
The state of any kernel is just an array of bytes. `WaForthService.ts` can serialize the entire WebAssembly memory state of a kernel to disk and hibernate it. This is incredibly powerful for massive worlds where thousands of entities might exist, but only a few kernels need to be "awake" at a time.

### D. Inter-Kernel Modularity (VSO)
Through Virtual Shared Objects (VSO), memory can be synchronized across kernels without breaking encapsulation. For instance, the `BattleKernel` can fetch `PlayerState` stats securely.

## 3. Current Problems with AJS

While the transpiler approach is innovative, the AJS specification is currently a *very* strict subset of JavaScript, which introduces several pain points, especially for procedural or LLM-driven generation:

### A. Severe Syntax Limitations
As seen in `AetherTranspiler.ts`, AJS lacks support for:
- Standard `for` loops (only simple `for(let i=0; i<N; i++)` is partially supported).
- Advanced objects, arrays of dynamic sizes, and complex data structures (everything must be a C-like struct or typed array).
- High-level functional array methods (`map`, `filter`, `reduce`).
- Complex `if/else if/else` chains or switch statements can become cumbersome to transpile properly.
- String manipulation is practically non-existent or extremely manual (pointer-based).

### B. Debugging Black Box
When an AJS script compiles incorrectly or crashes in Forth, the error logs (e.g., "word not supported in interpret mode") are highly cryptic. Tracing a Forth stack underflow back to the original AJS line is difficult, making rapid iteration hard for humans and even harder for an LLM that lacks a REPL loop for debugging.

### C. Recompilation Overhead
Currently, the JS Host must transpile the AJS to Forth and send it to the WAForth instance. Dynamically altering logic means we must either:
1. Reload/re-evaluate the whole script into the kernel.
2. Dynamically patch the dictionary (which is risky and complex in Forth).
There is currently no clean "hot-reloading" of specific functions inside a running kernel without risking memory fragmentation or pointer invalidation.

## 4. Proposal: LLM-Driven Dynamic Logic

The goal is to allow an LLM (via `WebLLMService` or `GeneratorService`) to generate or modify AJS logic on the fly, allowing for dynamically changeable game mechanics.

### Phase 1: Skill & Battle Effects Generation (The Sandbox)
The `BattleKernel` acts as a perfect sandbox. Combat skills (e.g., `skill_fireball`, `skill_heavy_smash`) are isolated, mathematically bounded, and stateless functions that take inputs (`srcId`, `tgtId`) and output state changes (HP).

**Implementation Steps:**
1. **Dynamic Dispatch Table:** Modify `BattleKernel.ts` to allow dynamic registration of skills. Instead of a hardcoded `if (skillId == 0) ...`, we can pre-allocate a block of memory for "Custom Skill Pointers".
2. **LLM Prompting (AJS-Strict):** Train the LLM (via a strict system prompt in `GeneratorService`) to output valid AJS for skills.
    * *Example Prompt Rules:* "You may only use variables, simple math (`+`, `-`, `*`, `/`), and the `rpg_table[id]` struct. You may call `log_combat()`. Do not use loops."
3. **Just-In-Time Transpilation:** When the LLM generates a new skill (e.g., `skill_vampiric_bite`), the JS Host passes it through `AetherTranspiler`, compiles it to Forth, and injects the new word into the `BattleKernel`'s dictionary. The Host then registers the new Forth word's execution token (XT) to the dynamic dispatch table.

### Phase 2: Behavioral AI (HiveKernel Extensions)
Once Battle effects are proven, we can move to the `HiveKernel`, which handles entity AI.

**Implementation Steps:**
1. **Behavioral Scripts:** Currently, AI is a hardcoded `decide_action(id)`. We can partition this into "Behavior Protocols" (e.g., `behavior_cowardly`, `behavior_berserker`).
2. **Dynamic Injection:** Similar to Phase 1, the LLM generates an AJS snippet governing movement based on the `LAST_PLAYER_X/Y` globals.
3. **Safety Rails:** Because infinite loops in WebAssembly will lock the JS main thread (if not web-workered), the AetherTranspiler must enforce a strict instruction/loop limit or strip `while` loops entirely from LLM-generated behavioral code.

### Phase 3: The "Architect" Mode
Allow the LLM to generate entirely new `structs` and logic. For example, if the LLM decides the game now has a "Weather" system, it generates:
1. A new VSO Struct for `WeatherState`.
2. A small AJS script to be injected into the `GridKernel`'s `run_env_cycle()` to apply random lightning damage.

## 5. Summary & Next Steps
To make this vision a reality, we must:
1. **Enhance AetherTranspiler:** Improve the transpiler's error reporting so the LLM can auto-correct its code if compilation fails (using the existing `repairForthCode` flow in `GeneratorService`).
2. **Dynamic Linking:** Add a mechanism in the Kernels to safely register new function pointers dynamically so we don't have to reboot the kernel to add a skill.
3. **Build the Feature:** Create a UI button (e.g., in `Architect View`) that prompts the user: "Describe a new battle skill." -> LLM generates AJS -> Transpiles to Forth -> Injected into `BattleKernel` -> Player can use it immediately.
