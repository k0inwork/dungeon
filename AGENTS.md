# Aethergard Agent Debugging Guidelines

As an AI engineer working on the Aethergard project, you have access to a fully programmable WebAssembly Forth (WAForth) environment transpiled from AetherJS (AJS). When encountering difficult bugs, logic errors, or memory corruption in AJS, you should **proactively use the programmatic debugging tools** available to you rather than guessing.

You can write custom test scripts or modify existing ones (`test_arr_runner.ts`, etc.) to spin up headless instances, inject breakpoints, and inspect the raw memory of the transpiled kernels.

## 1. Automated Breakpoint Injection & Tracing

The `AetherTranspiler` supports a `DEBUG_MODE` flag. When `true`, it automatically injects stack validation checks (`JS_ASSERT_STACK`) and maps `debugger;` statements to Forth breakpoints.

If a test is failing, you can programmatically inject a `debugger;` statement into the AJS source code right before the problematic logic, transpile it, and run it.

### Example: Headless Debugging Session

```typescript
import { AetherTranspiler } from "./src/compiler/AetherTranspiler";
import { forthService } from "./src/services/WaForthService";
import { STANDARD_KERNEL_FIRMWARE } from "./src/kernels/SharedBlocks";

async function debugLogic() {
    // 1. Get or Create a Headless Kernel
    const proc = forthService.get("TEST_KERNEL");
    await proc.boot();
    proc.run(STANDARD_KERNEL_FIRMWARE.join("\\n"));

    // 2. Prepare AJS Logic with a Breakpoint
    const ajsCode = \`
        let myVar = 10;
        function calculate() {
            myVar += 5;
            debugger; // Inject Breakpoint
            myVar *= 2;
        }
        calculate();
    \`;

    // 3. Transpile in DEBUG_MODE
    const isDebugMode = true;
    const forthCode = AetherTranspiler.transpile(ajsCode, 0, isDebugMode);

    // 4. Listen for the Breakpoint
    proc.onBreakpoint = (line: number) => {
        console.log(\`[AGENT] Breakpoint hit on AJS line: \${line}\`);

        // 5. Inspect the Symbol Table & Memory
        const symbolTable = AetherTranspiler.lastSymbolTable;
        const varForthName = symbolTable.get("MYVAR"); // e.g., "MYVAR"

        if (varForthName) {
            // Read the variable directly from the Forth Data Stack using a temporary word
            // Note: In a real scenario, you might read the raw ArrayBuffer memory map if you know the address.
            proc.run(\`\${varForthName} @ .N\`);
            console.log(\`Current MYVAR Value: \${proc.outputLog[proc.outputLog.length - 1]}\`);
        }
    };

    // 6. Execute the Code
    proc.run(forthCode);
}
```

## 2. Using the Symbol Table
The transpiler tracks the mapping between AJS variables/structs and their generated Forth memory addresses/names. You can access this via `AetherTranspiler.lastSymbolTable`.

- **Global Variables:** Mapped to `Name` (e.g., `HIVE_ENT_COUNT` -> `HIVE_ENT_COUNT`).
- **Local Variables:** Mapped to `LV_FunctionName_VarName` (e.g., `count` inside `run_cycle` -> `LV_RUN_CYCLE_COUNT`).

You can use these symbols to write Forth commands (`proc.run("LV_RUN_CYCLE_COUNT @ .N")`) to peek at variables dynamically during a breakpoint pause without modifying the AJS code with `Log()` statements.

## 3. Detecting Stack Leaks
If a kernel is crashing or behaving erratically, it is likely due to a Forth Data Stack leak (leaving extra items on the stack).

1. Enable `DEBUG_MODE` in the transpiler.
2. The transpiler will automatically inject `JS_ASSERT_STACK` after every expression.
3. If an AJS statement leaves an unhandled value on the stack, the kernel will immediately print an error: `[ASSERT_STACK] Failed! Expected X, got Y`.
4. The line number printed right before this error (`[TRACE] Executing line Z`) will tell you exactly which AJS statement caused the leak.

## 4. Kernel Swapping
If you need to patch a bug in a running simulation, you can compile a new kernel and swap it dynamically using `targetProc.swapWith(newProc)`. This preserves the old kernel's `Uint8Array` memory buffer, meaning the entities and state remain intact while the logic updates.

Always remember: When in doubt, **write a quick debug script** to isolate the AJS logic, transpile it, and inspect the stack/memory dynamically!