# WASM KERNEL SPECIFICATION (v3.4)

> **Status:** APPROVED DESIGN
> **Context:** Pure Forth Kernel.

## 1. LINEAR MEMORY MAP
Memory is strictly segmented. We define these as `CONSTANT` in Forth.

| Offset | Size | Name | Description |
| :--- | :--- | :--- | :--- |
| `0x00000` | 1 KB | **GLOBALS** | Global Config (Time, Seed, QueueCounters). |
| `0x00400` | 64 KB | **INPUT_QUEUE** | The Inbox (Host -> Guest). Capacity: 2048 Commands. |
| `0x10400` | 64 KB | **OUTPUT_QUEUE** | The Outbox (Guest -> Host). Capacity: 2048 Events. |
| `0x20400` | 64 KB | **CONTEXT** | Script Scratchpad. |
| `0x30400` | 128 KB | **TERRAIN_DEFS** | Registry of Tile Behaviors. |
| `0x50400` | 2 MB | **GRID_TILES** | The Map (ID + State). |
| `0x250400` | 4 MB | **ENTITY_TABLE** | The Actors. |

## 2. FORTH STRUCT DEFINITIONS

We don't have C structs. We use offset words.

```forth
\ Global Offsets
0x00400 CONSTANT PTR_INPUT_QUEUE
0x10400 CONSTANT PTR_OUTPUT_QUEUE

\ Entity Layout (32 Bytes)
: ENT_ID ( ptr -- addr ) ;       \ +0
: ENT_TYPE ( ptr -- addr ) 4 + ; \ +4
: ENT_X ( ptr -- addr ) 8 + ;    \ +8
: ENT_Y ( ptr -- addr ) 12 + ;   \ +12
: ENT_HP ( ptr -- addr ) 16 + ;  \ +16
: ENT_FLAGS ( ptr -- addr ) 20 + ; \ +20

\ Example Usage:
\ my_entity_ptr @ ENT_X @  ( Fetches X coordinate )
```

---

## 3. THE SIMULATION PIPELINE

### `PROCESS_INBOX` (Forth Word)
1.  Reads `INPUT_COUNT` from Globals.
2.  Loops through the buffer.
3.  Decodes Opcode.
4.  Calls corresponding word (e.g., `EXEC_MOVE`, `EXEC_SKILL`).

### `PROCESS_TURN` (Forth Word)
1.  Iterates through `ENTITY_TABLE`.
2.  Checks `ENT_HP > 0`.
3.  Calls AI logic if applicable.
