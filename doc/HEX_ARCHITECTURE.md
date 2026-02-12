# THE HONEYCOMB: HEXAGONAL ARCHITECTURE (v1.0)

> **Context:** Tier 2 Nodes (Strategy/War Fields).
> **Philosophy:** "Nature abhors a square. The Hexagon is the geometry of efficiency."

## 1. THE COORDINATE SYSTEM (Axial)

While the Orthogonal Grid uses Cartesian $(X, Y)$, the Hexagonal Grid uses **Axial Coordinates** $(Q, R)$.

### 1.1 Memory Mapping
The Wasm Linear Memory does not change structure; only interpretation changes.
*   **Memory:** `Entity.X` stores `Q` (Column).
*   **Memory:** `Entity.Y` stores `R` (Row).
*   **Derived:** $S = -Q - R$ (Cube coordinate, calculated on fly).

### 1.2 The Distance Metric
In `HexPhysics.wasm`, the `DISTANCE` word is replaced:
*   **Orthogonal:** $|x1 - x2| + |y1 - y2|$ (Manhattan).
*   **Hexagonal:** $(|q1 - q2| + |r1 - r2| + |s1 - s2|) / 2$.
*   **Implication:** Movement is uniform in 6 directions. No "diagonal cost" penalty needed.

---

## 2. TACTICAL VECTORS (Facing & Flanking)

Strategy games rely heavily on positioning relative to the target's attention.

### 2.1 Orientation (The Clock)
The `Entity.FACING` integer (0-5) maps to the 6 Hex sides.
*   `0`: East (+1, 0)
*   `1`: South-East (0, +1)
*   `2`: South-West (-1, +1)
*   `3`: West (-1, 0)
*   `4`: North-West (0, -1)
*   `5`: North-East (+1, -1)

### 2.2 The Flanking Bonus
When `RESOLVE_DAMAGE` runs in the Hex Kernel:
1.  Calculate `AttackAngle` = `Target.FACING` - `AttackDirection`.
2.  **Front (0-1):** Normal Damage.
3.  **Flank (2-3):** +25% Damage. (Side armor).
4.  **Rear (3-4):** +50% Damage. (Backstab).

---

## 3. ZONE OF CONTROL (ZoC)

Unlike the "slippery" movement of Roguelikes, Strategy Grids are "sticky".

### 3.1 The Sticky Rule
*   **Definition:** Tiles adjacent to a Hostile Entity are "Zone of Control".
*   **Mechanic:**
    *   Entering ZoC: Normal Cost.
    *   Exiting ZoC: **Double AP Cost** (Opportunity Attack risk).
    *   Moving ZoC-to-ZoC: **Forbidden** (Must stop to fight).
*   **Implementation:** The `HexPhysics.wasm` implementation of `GET_MOVE_COST` performs a neighbor check for hostiles before returning the cost.

---

## 4. UI PROJECTION (Hex-to-Pixel)

The Frontend `WorldCanvas` must handle the layout shift.

*   **Layout:** Pointy-topped hexes.
*   **Offset:** Odd-R layout (shoves odd rows right).
*   **Formula:**
    ```javascript
    pixel_x = size * (sqrt(3) * q + sqrt(3)/2 * r)
    pixel_y = size * (3./2 * r)
    ```

## 5. AREA OF EFFECT (AoE) PATTERNS

Spells shape differently on the Honeycomb.

*   **Cone:** A 60-degree sector expanding outward.
*   **Line:** A straight ray along one of the 6 axes.
*   **Ring:** All hexes at exactly distance $N$.
*   **Burst:** All hexes within distance $N$ (Honeycomb shape).

