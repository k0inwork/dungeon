
# DATA ARCHITECTURE v2: THE BLOB PROTOCOL

> **Problem:** The 24-byte (6 int) packet limit prevents complex interactions (e.g., "Give Item List", "Speak Long Text", "AI Plan").
> **Constraint:** Pausing kernels to copy memory (DMA) is invasive and slow.
> **Solution:** The **Event Stream Attachment (Blob)** Protocol.

---

## 1. THE CONCEPT
Instead of a separate "Big Data Event", we treat large data as an **Attachment** to a standard event.

We introduce a meta-opcode `SYS_BLOB (1000)`.
When the Router or a Kernel sees this, it knows: "The next N integers are raw data belonging to this event."

### Structure
A standard packet is 6 integers. A Blob packet is `6 + N` integers.

`[ SYS_BLOB | SENDER | TARGET | LENGTH | REAL_OP | 0 ]` + `[ ... DATA payload ... ]`

*   **LENGTH:** The number of integers in the payload.
*   **REAL_OP:** The event being wrapped (e.g., `CMD_SPEAK`, `EVT_INVENTORY`).
*   **DATA:** The raw bytes/ints.

---

## 2. THE PIPELINE

### Step A: Sender (Forth)
Uses `BUS_SEND_BLOB ( addr len sender target real_op -- )`.
1.  Writes the `SYS_BLOB` header to the Output Queue.
2.  Copies `len` cells from `addr` directly into the Output Queue immediately following the header.
3.  Increments the Queue Pointer by `6 + len`.

### Step B: Router (JavaScript)
1.  Reads the Opcode.
2.  If `OP == 1000`:
    *   Reads `P1` (Length).
    *   Reads `6 + Length` integers from the buffer.
    *   Routes the whole chunk to the Target's Input Queue.

### Step C: Receiver (Forth)
The new `PROCESS_INBOX` standard loop handles this transparently.
1.  Detects `SYS_BLOB`.
2.  Sets Register `M_OP` = `REAL_OP`.
3.  Sets Register `M_P1` = `LENGTH`.
4.  Sets Register `M_P2` = **Pointer to the Data Payload** (inside the Input Queue).
5.  Calls `HANDLE_EVENTS`.
6.  The Handler can now read the data using `M_P2 @`, `M_P2 4 + @`, etc.

---

## 3. USAGE EXAMPLES

### Scenario 1: NPC Speaking a generated sentence
*   **Old Way:** Impossible.
*   **New Way:**
    *   **Hive:** Generates string in Scratch memory.
    *   **Hive:** Calls `addr len K_HIVE K_PLAYER CMD_SPEAK BUS_SEND_BLOB`.
    *   **Player:** Recieves `CMD_SPEAK`. `M_P2` points to the string characters.
    *   **Player:** Copies string to Log Buffer or prints immediately.

### Scenario 2: Transferring Inventory
*   **Battle:** Loot drops.
*   **Battle:** Writes `[Item1ID, Item2ID, Item3ID]` to Scratch.
*   **Battle:** Calls `addr 3 K_BATTLE K_PLAYER EVT_LOOT BUS_SEND_BLOB`.
