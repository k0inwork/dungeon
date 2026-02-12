export const MEMORY = {
  // Input Queue: Host writes commands here (0x00400 - 0x10400)
  INPUT_QUEUE_ADDR: 0x00400,
  
  // Output Queue: Guest writes events here (0x10400 - 0x20400)
  OUTPUT_QUEUE_ADDR: 0x10400,

  // VRAM: The visual state of the world (0x80000)
  // Format: Uint32 [ 0x00RRGGBB (24-bit color) | 0xCC (8-bit char) ]
  VRAM_ADDR: 0x80000,
  
  // Grid Dimensions (Fixed for this scenario)
  GRID_WIDTH: 40,
  GRID_HEIGHT: 20,
};

// Calculated Size
export const VRAM_SIZE = MEMORY.GRID_WIDTH * MEMORY.GRID_HEIGHT * 4; // bytes

// Opcodes for Input Queue
export const OP = {
  MOVE_NORTH: 1,
  MOVE_SOUTH: 2,
  MOVE_WEST: 3,
  MOVE_EAST: 4,
  WAIT: 5
};

// Event Codes from Wasm
export const EVT = {
  GATEWAY_ENTERED: 100
};
