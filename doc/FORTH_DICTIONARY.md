
# AETHELGARD FORTH DICTIONARY (v1.0)

> **Context:** Reference for WAForth-compatible words used in the Aethelgard Engine.
> **Standard:** A subset of ANS Forth / Forth-2012 + Custom Primitives.

---

## 1. CORE STACK MANIPULATION
Standard words provided by WAForth or Polyfilled in `SharedBlocks.ts`.

| Word | Stack Signature | Description | Origin |
| :--- | :--- | :--- | :--- |
| `DUP` | `( x -- x x )` | Duplicate top item. | Native |
| `DROP` | `( x -- )` | Discard top item. | Native |
| `SWAP` | `( x1 x2 -- x2 x1 )` | Exchange top two items. | Native |
| `OVER` | `( x1 x2 -- x1 x2 x1 )` | Copy second item to top. | Native |
| `ROT` | `( x1 x2 x3 -- x2 x3 x1 )` | Rotate third item to top. | Native |
| `-ROT` | `( x1 x2 x3 -- x3 x1 x2 )` | Rotate top to third. | **Polyfill** |
| `NIP` | `( x1 x2 -- x2 )` | Drop item below top. | **Polyfill** |
| `2DUP` | `( x1 x2 -- x1 x2 x1 x2 )` | Duplicate top pair. | Native |
| `2DROP` | `( x1 x2 -- )` | Drop top pair. | **Polyfill** |
| `PICK` | `( xu ... x1 x0 u -- xu ... x1 x0 xu )` | Copy `u`-th item to top (0-based). | Native |
| `ROLL` | `( xu ... x1 x0 u -- ... x1 x0 xu )` | Move `u`-th item to top. | Native |

---

## 2. MEMORY & ARITHMETIC

| Word | Signature | Description |
| :--- | :--- | :--- |
| `@` | `( addr -- n )` | Fetch cell (32-bit). |
| `!` | `( n addr -- )` | Store cell (32-bit). |
| `C@` | `( addr -- c )` | Fetch byte (8-bit). |
| `C!` | `( c addr -- )` | Store byte (8-bit). |
| `+!` | `( n addr -- )` | Add `n` to value at `addr`. |
| `CELLS` | `( n -- n*4 )` | Convert cell count to bytes. |
| `CMOVE` | `( src dest u -- )` | Copy `u` bytes from `src` to `dest`. | **Polyfill** |
| `+ - * /` | `( n1 n2 -- n3 )` | Standard integer math. | Native |
| `MOD` | `( n1 n2 -- rem )` | Modulo. | Native |
| `ABS` | `( n -- |n| )` | Absolute value. | Native |
| `MAX` | `( n1 n2 -- max )` | Return larger value. | Native |
| `MIN` | `( n1 n2 -- min )` | Return smaller value. | Native |
| `LSHIFT` | `( x u -- x' )` | Bitwise Left Shift. | Native |
| `RSHIFT` | `( x u -- x' )` | Bitwise Right Shift. | Native |
| `AND OR XOR` | `( x1 x2 -- x3 )` | Bitwise Logic. | Native |

---

## 3. CONTROL STRUCTURES

| Word | usage | Description |
| :--- | :--- | :--- |
| `IF ... THEN` | `flag IF true_code THEN` | Standard conditional. |
| `IF ... ELSE ... THEN` | | If/Else. |
| `DO ... LOOP` | `limit start DO ... LOOP` | Counted loop. Index available via `I`. |
| `?DO ... LOOP` | | Like `DO` but skips if limit == start. |
| `BEGIN ... WHILE ... REPEAT` | | While loop. |
| `EXIT` | | Return from current definition. |

---

## 4. AETHELGARD UTILITIES (SharedBlocks.ts)

### 4.1 String & IO
| Word | Signature | Description |
| :--- | :--- | :--- |
| `S+` | `( addr len -- dest len )` | Append string to circular buffer, return new location. Safe for JS calls. |
| `S.` | `( addr len -- )` | Print string to Host Console. |
| `.N` | `( n -- )` | Print number to Host Console. |
| `.S` | `( -- )` | Dump stack to Host Console. |

### 4.2 Message Bus
| Word | Signature | Description |
| :--- | :--- | :--- |
| `BUS_SEND` | `( op sender target p1 p2 p3 -- )` | Push packet to Output Queue. |
| `BUS_READ_INPUT` | `( -- count )` | Read Input Queue count. |
| `GET_MSG_ADDR` | `( index -- addr )` | Get address of i-th input packet. |
| `UNPACK_MSG` | `( op sender target p1 p2 p3 -- )` | Pop stack into `M_*` registers. |

### 4.3 Registers (Variables)
Used by `UNPACK_MSG`.
`M_OP`, `M_SENDER`, `M_TARGET`, `M_P1`, `M_P2`, `M_P3`.

---

## 5. KERNEL SPECIFIC (GridKernel.ts)

| Word | Signature | Description |
| :--- | :--- | :--- |
| `TWO_OVER` | `( x1 x2 x3 x4 -- x1 x2 x3 x4 x1 x2 )` | Copies pair (x1,x2) to top. |
| `INIT_MAP` | `( -- )` | Clears VRAM and Collision Map. |
| `LOAD_TILE` | `( x y color char type -- )` | Sets tile in VRAM and Collision Map. |
| `SPAWN_ENTITY` | `( x y color char -- )` | Creates entity entry and draws it. |
| `MOVE_ENTITY` | `( id dx dy -- )` | Validation + State Update + Redraw. |
| `PROCESS_INBOX` | `( -- )` | Main Game Loop (Input Processing). |

