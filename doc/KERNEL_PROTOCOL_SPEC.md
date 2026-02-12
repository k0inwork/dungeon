
# AETHELGARD INTER-KERNEL PROTOCOL (AIKP) v2.0

> **Architecture:** Distributed Actor Model (Star Topology)
> **Router:** JavaScript Host
> **Nodes:** Wasm Kernels (Physics, Player, Hive, System)

---

## 1. ADDRESSING SCHEME

Every message on the bus follows a strict 6-integer header format (24 bytes).

### 1.1 The Message Packet
`[ OPCODE | SENDER_ID | TARGET_ID | PAYLOAD_1 | PAYLOAD_2 | PAYLOAD_3 ]`

*   **OPCODE:** What to do (e.g., `CMD_MOVE`).
*   **SENDER_ID:** Who sent it (Kernel ID).
*   **TARGET_ID:** Who receives it (Kernel ID).
*   **PAYLOAD:** 3 integers of data.

### 1.2 Kernel IDs (The Nodes)
| ID | Name | Role | "The Truth" |
| :--- | :--- | :--- | :--- |
| `0` | **HOST (JS)** | The Router & Renderer | Time, Input, Save Files |
| `1` | **PHYSICS** | The World Server | Positions, Collisions, Map |
| `2` | **PLAYER** | The Client | Inventory, UI State, Prediction |
| `3` | **HIVE** | The NPC Brains | AI Logic, Pathfinding Requests |

---

## 2. THE TICKER CYCLE (The Sync Protocol)

Synchronization is managed by the **Unified Simulation Ticker** in the Host.

### Phase 1: The Brokerage (Move Data)
1.  **Extract:** Host scans `OUTPUT_QUEUE` of all Kernels.
2.  **Log:** Host logs traffic to the Bus Inspector.
3.  **Route:** Host pushes packets to specific `INPUT_QUEUE` based on `TARGET_ID`.
4.  **Flush:** Kernels clear their `OUTPUT_QUEUE`.

### Phase 2: The Logic (Run Data)
1.  **Process Inboxes:**
    *   Host calls `PLAYER.run("PROCESS_INBOX")`.
    *   Host calls `GRID.run("PROCESS_INBOX")`.
2.  **Run Cycles (Optional):**
    *   *If Roguelike Mode:* Checks if Player Input occurred.
    *   *If Realtime Mode:* Checks if 100ms passed.
    *   Host calls `HIVE.run("RUN_HIVE_CYCLE")`.
    *   Host calls `GRID.run("RUN_ENV_CYCLE")`.

---

## 3. THE OPCODE REGISTRY

### 3.1 Physics Opcodes (100-199)
*Target: PHYSICS (ID 1)*

| Opcode | Name | P1 | P2 | P3 | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `101` | `REQ_MOVE` | `EntityID` | `dX` | `dY` | Request to move an entity. |
| `102` | `REQ_TELEPORT` | `EntityID` | `X` | `Y` | Request instant warp. |
| `103` | `REQ_TERRAIN` | `X` | `Y` | `TileID` | Request map modification. |

### 3.2 Event Opcodes (200-299)
*Broadcast from PHYSICS to ALL*

| Opcode | Name | P1 | P2 | P3 | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `201` | `EVT_MOVED` | `EntityID` | `X` | `Y` | Entity successfully moved. |
| `202` | `EVT_COLLIDE` | `EntityID` | `TargetID` | `Type` | Entity hit something (0=Wall, 1=Ent). |
| `203` | `EVT_SPAWN` | `EntityID` | `TypeID` | `X/Y` | New entity created. |

### 3.3 Interaction Opcodes (300-399)
*Target: LOGIC / HIVE / PLAYER*

| Opcode | Name | P1 | P2 | P3 | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `301` | `CMD_INTERACT` | `SourceID` | `TargetID` | `Verb` | "Player Touches NPC". |
| `302` | `CMD_SPEAK` | `SpeakerID` | `StringPtr` | `Tone` | NPC says something. |
| `303` | `CMD_DAMAGE` | `TargetID` | `Amount` | `Type` | Apply damage logic. |

---

## 4. SCENARIO: THE "BUMP" INTERACTION

**Context:** Player tries to move Right. There is an NPC there.

1.  **Input:** User presses Arrow Right.
2.  **Tick 1 (Broker):** 
    *   Host injects `REQ_MOVE` into PLAYER Inbox.
    *   PLAYER processes inbox, forwards `REQ_MOVE` to PHYSICS Inbox.
3.  **Tick 2 (Broker):**
    *   PHYSICS processes inbox. Checks `(PlayerX + 1)`.
    *   Finds `NPC_ID_50`. Movement Denied.
    *   PHYSICS writes `EVT_COLLIDE` to Output.
4.  **Tick 2 (Logic):**
    *   Host routes `EVT_COLLIDE` to PLAYER and HIVE.
5.  **Tick 3 (Reaction):**
    *   HIVE sees `EVT_COLLIDE`. NPC script triggers `CMD_SPEAK`.
    *   HIVE writes `CMD_SPEAK` to Output.
6.  **Tick 4 (Render):**
    *   Host reads `CMD_SPEAK` and displays UI.
