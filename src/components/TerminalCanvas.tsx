
import React, { useEffect, useRef } from 'react';

interface TerminalCanvasProps {
  memoryBuffer: ArrayBuffer | null;
  width: number;
  height: number;
  cursor?: { x: number, y: number } | null; // New Prop for Targeting
  onGridClick?: (x: number, y: number) => void;
}

export const TerminalCanvas: React.FC<TerminalCanvasProps> = ({ memoryBuffer, width, height, cursor, onGridClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const CHAR_W = 12;
  const CHAR_H = 20;

  useEffect(() => {
    if (!memoryBuffer || !canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // View into VRAM
    const vram = new Uint32Array(memoryBuffer);
    
    if (vram.length < width * height) {
        console.warn(`[TerminalCanvas] Buffer too small! Expected ${width * height}, got ${vram.length}`);
        return;
    }

    ctx.font = `${CHAR_H}px "Courier New", monospace`;
    ctx.textBaseline = 'top';

    // Fast Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width * CHAR_W, height * CHAR_H);

    // 1. Render Grid
    for (let i = 0; i < width * height; i++) {
      const cell = vram[i];
      if (cell === 0) continue; 

      const charCode = cell & 0xFF;
      const colorInt = (cell >>> 8) & 0xFFFFFF;
      
      const x = (i % width) * CHAR_W;
      const y = Math.floor(i / width) * CHAR_H;

      const colorHex = '#' + colorInt.toString(16).padStart(6, '0');
      ctx.fillStyle = colorHex;
      ctx.fillText(String.fromCharCode(charCode), x, y);
    }

    // 2. Render Cursor Overlay
    if (cursor) {
        const cx = cursor.x * CHAR_W;
        const cy = cursor.y * CHAR_H;
        
        ctx.strokeStyle = 'cyan';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, cy, CHAR_W, CHAR_H);
        
        // Add a crosshair effect
        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.fillRect(cx, cy, CHAR_W, CHAR_H);
    }

  }, [memoryBuffer, width, height, cursor]); // Re-render when cursor moves

  const handleClick = (e: React.MouseEvent) => {
      if (!onGridClick || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const gridX = Math.floor(x / CHAR_W);
      const gridY = Math.floor(y / CHAR_H);
      
      if (gridX >= 0 && gridX < width && gridY >= 0 && gridY < height) {
          onGridClick(gridX, gridY);
      }
  };

  return (
    <canvas 
      ref={canvasRef}
      width={width * CHAR_W}
      height={height * CHAR_H}
      onClick={handleClick}
      style={{ border: '1px solid #333', backgroundColor: '#000', cursor: cursor ? 'crosshair' : 'default' }}
    />
  );
};
