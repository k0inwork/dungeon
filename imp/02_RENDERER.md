# IMPLEMENTATION PHASE 2: THE RENDERER

## 1. OBJECTIVE
Render a 60x30 ASCII grid at 60fps by reading directly from Wasm Memory, avoiding object allocation overhead.

## 2. MEMORY LAYOUT
Define constants in `src/constants/Memory.ts`.
*   `RENDER_BUFFER_OFFSET = 0x80000`
*   `GRID_WIDTH = 60`
*   `GRID_HEIGHT = 30`

## 3. STEPS

### 3.1 The Canvas Component
Create `src/components/TerminalCanvas.tsx`.
*   **Props:** `scale: number` (default 16px font).
*   **Setup:** Get `2d` context. Set font to `'Courier New'`.

### 3.2 The Render Loop
Use `requestAnimationFrame`.

```typescript
const draw = () => {
  if (!forth.isReady) return;
  
  // Create a View into Wasm Memory
  const bufferPtr = RENDER_BUFFER_OFFSET;
  const len = GRID_WIDTH * GRID_HEIGHT;
  // Use Uint32 for [Color(24) | Char(8)]
  const vram = new Uint32Array(forth.memory.buffer, bufferPtr, len);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < len; i++) {
    const cell = vram[i];
    if (cell === 0) continue; // Skip empty

    const charCode = cell & 0xFF;
    const colorInt = (cell >> 8) & 0xFFFFFF;
    const x = (i % GRID_WIDTH) * CHAR_W;
    const y = Math.floor(i / GRID_WIDTH) * CHAR_H;

    ctx.fillStyle = `#${colorInt.toString(16).padStart(6, '0')}`;
    ctx.fillText(String.fromCharCode(charCode), x, y);
  }
  
  requestAnimationFrame(draw);
};
```

### 3.3 The Font Measurer
Implement a helper to calculate exact `CHAR_W` and `CHAR_H` based on `ctx.measureText('M')` to ensure perfect grid alignment.
