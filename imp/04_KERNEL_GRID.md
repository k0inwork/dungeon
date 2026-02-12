# IMPLEMENTATION PHASE 4: THE GRID KERNEL

## 1. OBJECTIVE
Write the core physics engine in Forth (`public/kernels/grid_core.fs`).

## 2. MEMORY MAP
Define these `CONSTANT`s at the top of the file to match `src/constants/Memory.ts`.

```forth
0x00400 CONSTANT INPUT_QUEUE
0x10400 CONSTANT OUTPUT_QUEUE
0x80000 CONSTANT VRAM_BUFFER
```

## 3. CORE WORDS

### 3.1 Math Helpers
*   `ABS ( n -- n )`
*   `MAX ( n n -- n )`
*   `DISTANCE ( x1 y1 x2 y2 -- dist )`

### 3.2 Entity Accessors
Structure helpers for reading the Entity Table.
*   `: ENT_X ( id -- addr ) ... ;`
*   `: ENT_Y ( id -- addr ) ... ;`

### 3.3 Rendering
`: DRAW_POINT ( x y color char -- )`
Calculates offset in `VRAM_BUFFER` and stores the packed u32.

### 3.4 The Event Loop
`: PROCESS_INPUT`
Reads from `INPUT_QUEUE`.
Switch statement on Opcode:
*   `OP_MOVE_UP` -> Call `ATTEMPT_MOVE_NORTH`
*   `OP_WAIT` -> Call `RUN_TURN`

## 4. PATHFINDING (A*)
Implement a basic BFS or Dijkstra first for stability.
`: FIND_PATH ( start_x start_y end_x end_y -- next_step_dir )`
