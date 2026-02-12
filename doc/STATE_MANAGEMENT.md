# STATE MANAGEMENT PROTOCOL: THE SHARED BUFFER (v1.0)

> **Objective:** Zero-Copy Rendering.
> **Problem:** Marshalling thousands of objects between Wasm and JS is slow.
> **Solution:** Shared Memory Views.

---

## 1. THE VIEWPORT MEMORY MAP

To render the ASCII grid at 60fps, the React Renderer does **not** ask Wasm "Where is everyone?".
Instead, Wasm maintains a **Render Buffer** in its linear memory that React reads directly.

### 1.1 The Render Buffer (Wasm Side)
Located at `0x80000` (Fixed Offset).
Structure: `Array[Height * Width]` of `u32`.

**The `u32` Pixel Format:**
*   **Bits 0-7:** ASCII Char Code (e.g., 64 = '@')
*   **Bits 8-31:** Color RGB (e.g., 0xFF0000)

### 1.2 The Rendering Loop

1.  **Wasm Update:**
    *   During `PROCESS_TURN`, Wasm clears the buffer.
    *   Iterates Terrain -> Writes Wall Chars.
    *   Iterates Entities -> Writes Entity Chars (Overwriting terrain).
    *   *Result:* A flat map of exactly what should be displayed.

2.  **JS Render:**
    ```typescript
    // In Canvas Component
    const renderMem = new Uint32Array(wasm.exports.memory.buffer, 0x80000, WIDTH * HEIGHT);
    
    for (let i = 0; i < renderMem.length; i++) {
       const cell = renderMem[i];
       const charCode = cell & 0xFF;
       const color = (cell >> 8).toString(16);
       
       ctx.fillStyle = "#" + color;
       ctx.fillText(String.fromCharCode(charCode), x, y);
    }
    ```

## 2. ADVANTAGE
*   **Speed:** No JSON parsing. No object creation. Just integer bit-shifting.
*   **Synchronization:** React always draws exactly what Wasm thinks the world looks like.

## 3. PARTICLE EFFECTS (The Exception)
Particles (`*`, `!`, `?`) are ephemeral and high-frequency.
*   **Managed by:** JavaScript.
*   **Layer:** Drawn *on top* of the Wasm Grid.
*   **Trigger:** Wasm emits `EVT_VFX` -> JS adds particle to `ParticleSystem` -> JS animates and draws.
