
# DATA ARCHITECTURE: THE FIXED-BUS STRATEGY

> **Problem:** As NPC complexity grows (Inventory, Memories, Stats), the data required to describe an entity exceeds the 24-byte limit of the Event Bus.
> **Constraint:** We cannot expand the Event Bus struct (`p4, p5...`) without destroying performance.
> **Solution:** Reference-Based Architecture & Host-Mediated DMA.

---

## 1. THE FALLACY OF "FAT EVENTS"

**Incorrect Approach:**
Trying to cram data into the packet.
*   `EVT_SPAWN [ID, HP, STR, DEX, GOLD, ITEM1, ITEM2...]` -> **Impossible.**

**Correct Approach (The ID Compression):**
Kernels share a common static understanding of "Types", but maintain their own dynamic instance data.
*   `EVT_SPAWN [ID, TYPE_ID, X, Y]` -> **Efficient.**

### The Distributed Truth
When `EVT_SPAWN(ID: 5, TYPE: RAT)` is broadcast:
1.  **Grid Kernel:** Sees `RAT`. Looks up `RAT` in `CollisionTable`. Sets `Size=0.5`.
2.  **Battle Kernel:** Sees `RAT`. Looks up `RAT` in `StatsTable`. Sets `HP=10`, `Atk=2`.
3.  **Hive Kernel:** Sees `RAT`. Looks up `RAT` in `BehaviorTable`. Sets `AI=AGGRESSIVE`.

**Result:** We transferred massive implicit data using a single integer (`TYPE: RAT`).

---

## 2. HANDLING DYNAMIC DATA GROWTH

What if the Rat picks up a generic item? Or gets a unique scar? This cannot be compressed into a Type ID.

### Strategy A: Host-Mediated DMA (Direct Memory Access)
The Host (JavaScript) is the only actor with access to ALL Kernel memories.

*   **Scenario:** Player inspects a Rat.
*   **Old Way:** Rat sends `EVT_STATS [HP, MP, EXP...]` to Bus. (Spammy).
*   **New Way (Pull Model):**
    1.  UI requests inspect.
    2.  Host reads `GridKernel` memory to get ID.
    3.  Host reads `BattleKernel` memory (`RPG_TABLE + offset`) directly to get HP/Stats.
    4.  Host reads `InventoryKernel` memory directly to get Items.
    5.  Host combines data in React State.
    *   **Bus Traffic:** 0 messages.

### Strategy B: The "Pointer & Notice" Protocol (For Inter-Kernel Ops)
Sometimes Kernels *do* need to exchange complex data (e.g., A "Steal" skill moving an Item from Target to Source).

1.  **Source Kernel (Battle):** Wants to transfer an Item struct.
    *   Writes the Item Data to a temporary "Transfer Buffer" in its own memory.
    *   Sends `REQ_TRANSFER [SourceID, TargetID, Pointer, Length]`.
2.  **Host (Router):**
    *   Intercepts `REQ_TRANSFER`.
    *   **Pauses** execution.
    *   **Copies** bytes from Source Kernel Memory (`Pointer`) to Target Kernel's Input Buffer.
    *   Writes `CMD_RECEIVE_DATA` to Target Kernel.
3.  **Target Kernel (Inventory):**
    *   Processes `CMD_RECEIVE_DATA`. Reads the raw bytes from its Input Buffer.

---

## 3. MEMORY SEGMENTATION (Avoiding Overlap)

To prevent "Map Memory Injection" (where every kernel needs to know the map), we strictly isolate domains.

| Kernel | Owns | Knows About Others |
| :--- | :--- | :--- |
| **GRID** | Coordinates, Terrain, Collision | **Nothing.** It only emits `COLLIDE` events. |
| **HIVE** | ID -> AI State Mapping | **Coordinates.** It caches X/Y from `EVT_MOVED` to run A*. |
| **BATTLE** | ID -> HP/Stats | **Nothing.** It reacts to `CMD_ATTACK` and emits `EVT_DEATH`. |

### The "Shadow State" Optimization
The **HIVE** needs map data for pathfinding, but copying the whole `GRID` memory is wasteful.
*   **Optimization:** The Hive requests *only* what it needs.
*   **Protocol:** `REQ_PATH_STEP [MyX, MyY, TargetX, TargetY]`.
*   **Response:** Grid calculates the A* step and returns `CMD_FORCE_MOVE [Dir]`.
*   **Benefit:** Hive doesn't need a map. It just needs a "GPS Service" (The Grid).

---

## 4. FUTURE PROOFING: VARIABLE LENGTH PACKETS

If we eventually need variable length packets on the bus itself (e.g. text chat):

*   **Header:** `[ OP | LEN | ... ]`
*   **Payload:** The next `LEN` integers in the buffer are the payload.
*   **Parser:** The `PROCESS_INBOX` loop must be updated to skip `LEN` cells after reading the header.
*   **Status:** Not currently implemented. Use **Strategy A** (Host Read) for text.
