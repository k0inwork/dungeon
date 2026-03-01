# Aethelgard JavaScript (AJS) Language Specification

## 1. Introduction
Aethelgard JavaScript (AJS) is a strict, highly specialized subset of JavaScript. It is designed to be written like high-level JS but is transpiled directly into WebAssembly Forth (via `AetherTranspiler`) to run within isolated, high-performance execution kernels.

AJS lacks standard JS features like garbage collection, closures, standard dynamic arrays, or the DOM. Instead, it provides direct, deterministic control over the kernel's memory space and high-speed message passing via channels.

## 2. Currently Supported Syntax & Features

### A. Variables & Constants
All variables are essentially 32-bit integers (cells).
*   **Constants**: `const MAX_ENTITIES = 32;` (Transpiled as a Forth `CONSTANT`)
*   **Variables**: `let count = 0;` (Transpiled as a Forth `VARIABLE` and accessed via `@` and `!`)

### B. Functions
Functions operate normally, but with strict scoping rules.
*   Arguments and local variables are managed via local variable scopes in Forth (`LV_FuncName_VarName`).
*   Example:
    ```javascript
    function calc_dist(x, y) {
        let dx = x * x;
        let dy = y * y;
        return dx + dy;
    }
    ```

### C. Control Flow
Control flow is significantly restricted compared to standard JS:
*   **If/Else**: Standard `if (condition) { ... } else { ... }` is supported.
*   **While Loops**: `while (condition) { ... }` is supported.
*   **For Loops**: *Highly Restricted*. Only simple `for(let i=0; i<N; i++)` is partially supported. Nested loops or complex loop updates will fail to transpile correctly.

### D. Math & Bitwise Operations
Standard mathematical and bitwise operators are supported and map directly to their Forth equivalents:
`+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `>`, `<=`, `>=`, `&`, `|`, `^`, `<<`, `>>`, `>>>`.
*(Note: Math object support is limited to specific methods like `Math.floor`, `Math.max`, `Math.min`, `Math.abs`, and `Math.random`)*

## 3. AJS Unique Syntax: Structs and Memory

Because AJS runs in a raw memory space, standard JavaScript Objects (dynamic, garbage-collected key-value maps) are **strictly forbidden**. Object creation is handled via C-style structs and direct memory addressing.

### A. Structs vs. JS Objects
*   **JS Objects (Forbidden):** `let obj = { x: 10, name: "Goblin" };`. Attempting to use this syntax will cause a transpilation error. You cannot add/remove keys dynamically.
*   **AJS Structs (Required):** A `struct` defines a rigid, fixed-size memory layout. When you access a struct via `let ent = GridEntity(0);`, you are retrieving a raw 32-bit integer pointer (a memory address) into WebAssembly linear memory. When you assign a property `ent.x = 10`, the transpiler emits raw Forth instructions to calculate the byte-offset and store the value directly at that memory address.

AJS introduces a non-standard `struct` keyword used by the transpiler to generate these byte-offsets:
```javascript
// Defines a 20-byte struct (5 fields * 4 bytes/cell)
struct GridEntity {
    char,
    color,
    y,
    x,
    type
}
```

### B. Struct Arrays & Virtual Shared Objects (VSO)
You cannot instantiate a loose struct (e.g., `let x = new GridEntity()`). You must allocate a block of raw memory for it, usually as an array:
```javascript
// Array of GridEntity, size 32, starting at memory address 0x90000
let entities = new Array(GridEntity, 32, 0x90000);

// Accessing the struct (Returns a pointer to the specific struct instance)
function get_ent(id) {
    return GridEntity(id);
}

// Accessing fields:
let ent = get_ent(0);
ent.x = 10;
ent.y = 20;
```
*Note: The `export entities;` syntax allows this array to be accessed by other kernels via the VSO system.*

### C. Direct Memory Access (Pointers)
AJS allows direct byte (`C@`/`C!`) and cell (`@`/`!`) memory manipulation via reserved identifiers:
*   `MEM8[address] = value` (Write Byte)
*   `let val = MEM32[address]` (Read 32-bit Cell)
Typed arrays (`Uint8Array`, `Uint32Array`, `Int32Array`) are also used to map arrays to specific raw memory addresses:
```javascript
const VRAM = new Uint32Array(0x80000);
VRAM[calc_idx(x, y)] = (color << 8) | char;
```

## 4. AJS Unique Syntax: Channels (Go-Style Message Passing)

The most significant departure from standard JS in AJS is the **Channel System**, heavily inspired by Go channels. Aethelgard relies on a Star Topology for inter-kernel communication (AIKP).

### A. Sending Messages
The left-arrow `<-` operator is used to send a packet over the message bus.
**Syntax:** `Chan("ChannelName") <- [Opcode, Param1, Param2, Param3]`

```javascript
// Example: Requesting the GridKernel to move entity ID 5 by (dx: 1, dy: 0)
Chan("GRID") <- [REQ_MOVE, 5, 1, 0];

// Sending to the global bus
Chan("BUS") <- [EVT_DAMAGE, targetId, damageAmount, type];

// Sending to self
Chan() <- [CMD_INTERNAL_UPDATE, 0, 0, 0];
```

### B. Receiving Messages
To handle incoming messages, you register a listener function to a specific channel:
```javascript
function on_grid_request(op, sender, p1, p2, p3) {
    if (op == REQ_MOVE) { move_entity(p1, p2, p3); }
}

// In initialization phase:
Chan("BUS").on(on_grid_request);
```

## 5. Built-in Kernel Functions
AJS has several built-in global functions injected by the transpiler environment:
*   `Log("Message")`: Outputs a string to the engine's standard log.
*   `Log(number)`: Outputs a number.
*   `bus_send(op, sender, target, p1, p2, p3)`: The low-level functional equivalent of the `Chan()` operator.

## 6. What AJS Does NOT Support (Currently)
An LLM attempting to write AJS will fail if it tries to use standard modern JS conventions:
1.  **NO Objects:** `let obj = { x: 10, y: 20 }` (Syntax Error)
2.  **NO Standard Arrays:** `let arr = [1, 2, 3]` (Syntax Error)
3.  **NO Closures:** Functions cannot access variables from a parent function's scope.
4.  **NO Strings:** Strings are only supported as constants in `Log("string")`. You cannot assign strings to variables or manipulate them (`let s = "hello" + "world"` will fail).
5.  **NO Switch Statements:** Must use `if / else if / else`.