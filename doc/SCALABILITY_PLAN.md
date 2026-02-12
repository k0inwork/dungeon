
# SCALABILITY STRATEGY: THE THOUSAND-ENTITY HORIZON

> **Problem:** As Entity Count (N) increases, the Event Bus traffic grows at O(N) or worse (N*Listeners).
> **Goal:** Support 100+ Active Entities without lag.

---

## 1. THE BOTTLENECK: REACT RENDERING
The JavaScript execution of 1000 bus events is fast (~2ms). The bottleneck is **Rendering** those 1000 lines to the DOM in the "Bus Monitor" sidebar.

### Solution 1: Bus Filtering (Implemented)
*   **Mechanism:** Stop rendering `REQ_MOVE` and `EVT_MOVED` unless specifically requested.
*   **Impact:** Reduces UI load by 95% during normal gameplay. Only "Interesting" events (Combat, Interaction) are shown.

### Solution 2: Sampled Logging (Future)
*   If traffic exceeds 50 msg/sec, switch to "Sampling Mode" where we only render 1 in 10 packets to the UI, while still processing all of them in logic.

---

## 2. THE BOTTLENECK: WASM INTEROP
Passing data between kernels requires JS glue code.

### Solution 3: The Kernel-to-Kernel Bridge (Future)
We can optimize the `Bus.send` routine. Instead of copying data to JS and back to another Wasm instance, we can (in theory) share a `WebAssembly.Memory` buffer between instances.
*   **Shared Heap:** All Kernels share one large Linear Memory.
*   **Zero-Copy Routing:** `GridKernel` writes directly to `HiveKernel`'s input offset.
*   **Status:** Requires significant architectural refactor (Unified Memory Map). Not needed for < 500 entities.

---

## 3. SPATIAL PARTITIONING (Activation Zones)

We do not need to run AI for entities 100 tiles away.

### Solution 4: The "Active List"
*   **Current:** `HiveKernel` iterates 1 to `MAX_ENTITIES`.
*   **Proposed:**
    1.  `GridKernel` maintains a `SectorMap` (Low-res grid, e.g., 10x10 chunks).
    2.  `GridKernel` sends `EVT_WAKE(id)` when player enters a Sector.
    3.  `HiveKernel` sets `Entity.AWAKE = 1`.
    4.  `HiveKernel` loop: `IF (AWAKE) RunAI()`.
    5.  `GridKernel` sends `EVT_SLEEP(id)` when player leaves.

---

## 4. AGGREGATED EVENTS

Instead of 50 separate `EVT_MOVED` packets, we can pack them.

### Solution 5: Vector Packets
*   **Protocol:** `EVT_BULK_MOVE`
*   **Payload:** Pointer to a buffer containing `[ID, X, Y, ID, X, Y...]`.
*   **Benefit:** 1 JS Call overhead for 50 entities.

---

## 5. DATA COMPLEXITY SCALING (See doc/DATA_ARCHITECTURE.md)

As entities gain complex stats, we avoid sending them over the bus.

### Solution 6: ID Compression
*   Entities are defined by `TYPE_ID`.
*   Kernels hydrate stats from static lookups based on Type, rather than receiving 20 integers of stats over the wire.

### Solution 7: Host-Mediated DMA
*   For inspecting inventory/stats, the UI reads directly from Wasm Memory.
*   No events are dispatched for passive data inspection.
