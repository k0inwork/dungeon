
// Aethelgard Grid Physics Kernel v5.0 (FULL AJS MIGRATION)
import { STANDARD_KERNEL_FIRMWARE, BLOCK_STANDARD_INBOX } from "./SharedBlocks";
import { AetherTranspiler } from "../compiler/AetherTranspiler";

// 1. GRID CONSTANTS (FORTH)
const BLOCK_MEMORY = `
40 CONSTANT MAP_WIDTH
20 CONSTANT MAP_HEIGHT
HEX
30000 CONSTANT COLLISION_MAP
40000 CONSTANT TERRAIN_MAP
30400 CONSTANT PLAYER_STATE
80000 CONSTANT VRAM_BASE
90000 CONSTANT ENTITY_TABLE
DECIMAL
32 CONSTANT MAX_ENTITIES
VARIABLE ENTITY_COUNT
0 ENTITY_COUNT !
`;

// 2. UTILS (FORTH)
const BLOCK_UTILS = `
: TWO_OVER ( x1 x2 x3 x4 -- x1 x2 x3 x4 x1 x2 ) 3 PICK 3 PICK ;
: CALC_VRAM_ADDR ( x y -- addr ) MAP_WIDTH * + 4 * VRAM_BASE + ;
: CALC_COLLISION_ADDR ( x y -- addr ) MAP_WIDTH * + COLLISION_MAP + ;
: CALC_TERRAIN_ADDR ( x y -- addr ) MAP_WIDTH * + 4 * TERRAIN_MAP + ;
( Keep DRAW_CELL in Forth for speed, but call it from AJS )
: DRAW_CELL ( x y color char -- ) >R >R 2DUP CALC_VRAM_ADDR R> 8 LSHIFT R> OR SWAP ! 2DROP ;
: REDRAW_CELL ( x y color char -- ) DRAW_CELL ;
`;

// 3. LOGIC (AJS)
const AJS_LOGIC = `
struct GridEntity {
    char,
    color,
    y,
    x,
    type
}

// 20 bytes per entity (5 ints)
// Global ENTITY_TABLE is base

function get_ent_ptr(id) {
    return ENTITY_TABLE + (id * SIZEOF_GRIDENTITY);
}

function check_bounds(x, y) {
  if (x < 0) return 0;
  if (x >= MAP_WIDTH) return 0;
  if (y < 0) return 0;
  if (y >= MAP_HEIGHT) return 0;
  return 1;
}

// --- MAP & INIT (MIGRATED FROM FORTH) ---

function init_map() {
    let y = 0;
    // Clear Loops
    while (y < MAP_HEIGHT) {
        let x = 0;
        while (x < MAP_WIDTH) {
            // Draw empty space (Color 0, Char 32=' ')
            draw_cell(x, y, 0, 32);
            
            // Clear Collision Map (Byte)
            let colAddr = calc_collision_addr(x, y);
            MEM8[colAddr] = 0;

            // Clear Terrain Map (Int)
            let terAddr = calc_terrain_addr(x, y);
            MEM32[terAddr] = 0;

            x++;
        }
        y++;
    }
    ENTITY_COUNT = 0;
    Log("[GRID] Map Initialized (AJS v5.0)");
}

function load_tile(x, y, color, char, type) {
    // 1. Store Terrain Data [Color | Char]
    let terAddr = calc_terrain_addr(x, y);
    // Pack color (24bit) and char (8bit)
    // Note: Transpiler supports << and |
    let packed = (color << 8) | char;
    MEM32[terAddr] = packed;

    // 2. Update Collision
    // type 1 = Wall/Blocked. type 0 = Walkable.
    let colAddr = calc_collision_addr(x, y);
    
    // Safety check for non-zero type
    if (type != 0) {
        MEM8[colAddr] = 1; 
    } else {
        MEM8[colAddr] = 0;
    }
    
    // 3. Draw to VRAM
    draw_cell(x, y, color, char);
}

// --- ENTITY MANAGEMENT ---

// O(N) Lookup for Entities
function find_entity_at(x, y) {
  let i = 0;
  while (i < ENTITY_COUNT) {
    let ent = get_ent_ptr(i);
    // Entity might be dead/cleared, check char != 0
    if (ent.char != 0) {
        if (ent.x == x) {
           if (ent.y == y) {
              return i;
           }
        }
    }
    i++;
  }
  return -1;
}

function spawn_entity(x, y, color, char, type) {
  if (ENTITY_COUNT >= MAX_ENTITIES) return;

  let ent = get_ent_ptr(ENTITY_COUNT);
  
  ent.char = char;
  ent.color = color;
  ent.y = y;
  ent.x = x;
  ent.type = type;

  // Draw
  draw_cell(x, y, color, char);
  
  // Set Collision (Only if NOT type 3/Item)
  if (type != 3) {
      let colAddr = calc_collision_addr(x, y);
      MEM8[colAddr] = 1;
  }
  
  // Notify Bus (Battle Kernel listens to init stats)
  // Payload: ID, AI_TYPE, 0
  Bus.send(EVT_SPAWN, K_PHYSICS, K_BUS, ENTITY_COUNT, type, 0);
  
  // Notify Hive Kernel (Position update so it knows entity exists)
  Bus.send(EVT_MOVED, K_PHYSICS, K_BUS, ENTITY_COUNT, x, y);
  
  ENTITY_COUNT++;
}

// Smart Refresh: Draws terrain, then overlays any entities at that spot
function refresh_tile(x, y, skipId) {
    // 1. Get Base Terrain from Memory
    let tAddr = calc_terrain_addr(x, y);
    let packed = MEM32[tAddr];
    
    // Unpack: [Color 24 | Char 8]
    let char = packed & 255;
    let color = packed >>> 8; // logical shift right
    
    // 2. Check for other entities (Layering)
    let i = 0;
    while (i < ENTITY_COUNT) {
        if (i != skipId) {
            let ent = get_ent_ptr(i);
            if (ent.char != 0) {
                if (ent.x == x) {
                    if (ent.y == y) {
                        // Found entity on top
                        char = ent.char;
                        color = ent.color;
                    }
                }
            }
        }
        i++;
    }
    
    redraw_cell(x, y, color, char);
}

function move_entity(id, dx, dy) {
  let ent = get_ent_ptr(id);
  
  if (ent.char == 0) return; // Dead entity

  let tx = ent.x + dx;
  let ty = ent.y + dy;

  if (check_bounds(tx, ty) == 0) return;

  // Collision Check
  let colAddr = calc_collision_addr(tx, ty);
  let col = MEM8[colAddr];

  if (col != 0) {
      // Hit something
      let obs = find_entity_at(tx, ty);
      
      if (obs == -1) {
         // Wall Hit
         Bus.send(EVT_COLLIDE, K_PHYSICS, K_BUS, id, 0, 0);
      } else {
         // Entity Hit (obs = Entity ID)
         Bus.send(EVT_COLLIDE, K_PHYSICS, K_BUS, id, obs, 1);
      }
      return;
  }
  
  // No Collision - Move
  let oldColAddr = calc_collision_addr(ent.x, ent.y);
  MEM8[oldColAddr] = 0; // Clear old collision
  
  // Redraw Old Tile (Restore Terrain or other items)
  refresh_tile(ent.x, ent.y, id);

  ent.x = tx;
  ent.y = ty;
  
  MEM8[colAddr] = 1; // Set new collision
  
  // Redraw New (Draw Self)
  redraw_cell(tx, ty, ent.color, ent.char);
  
  Bus.send(EVT_MOVED, K_PHYSICS, K_BUS, id, tx, ty);
}

function kill_entity(id) {
    let ent = get_ent_ptr(id);
    
    // Clear Collision (Make tile walkable again so player can pick up loot)
    let colAddr = calc_collision_addr(ent.x, ent.y);
    MEM8[colAddr] = 0;
    
    // Transform into Loot Bag
    // 36 = '$', 16766720 = Gold (0xFFD700)
    ent.char = 36;
    ent.color = 16766720; 
    ent.type = 3; // Type 3 = Item/Loot
    
    redraw_cell(ent.x, ent.y, ent.color, ent.char);
    Log("[GRID] Entity Dropped Loot");
}

function try_pickup(playerId, x, y) {
    // Check if there is an ITEM (Type 3) at x,y
    let i = 0;
    while (i < ENTITY_COUNT) {
        let ent = get_ent_ptr(i);
        // Ensure entity is active (char != 0)
        if (ent.char != 0) {
            if (ent.type == 3) { // It is loot
                if (ent.x == x) {
                    if (ent.y == y) {
                        // FOUND LOOT!
                        // Remove it visually and logically
                        ent.char = 0; 
                        ent.x = -1;
                        ent.y = -1;
                        // Redraw Floor (Restore Terrain)
                        refresh_tile(x, y, -1);
                        
                        // Notify Player specifically (Point-to-Point)
                        Bus.send(EVT_ITEM_GET, K_PHYSICS, K_PLAYER, playerId, i, 0);
                        return;
                    }
                }
            }
        }
        i++;
    }
}

function dist_sq(x1, y1, x2, y2) {
    let dx = x1 - x2;
    let dy = y1 - y2;
    return (dx * dx) + (dy * dy);
}

// Greedy Best-First Move
function move_towards(id, tx, ty) {
    let ent = get_ent_ptr(id);
    let bestDist = dist_sq(ent.x, ent.y, tx, ty);
    let bestDx = 0;
    let bestDy = 0;
    
    // Check 4 Neighbors: N, S, W, E
    
    // 1. North (0, -1)
    let cx = ent.x;
    let cy = ent.y - 1;
    if (check_bounds(cx, cy)) {
        let col = MEM8[calc_collision_addr(cx, cy)];
        
        let is_valid = 0;
        if (col == 0) { is_valid = 1; }
        else {
           if (cx == tx) {
               if (cy == ty) {
                   is_valid = 1;
               }
           }
        }

        if (is_valid) {
            let d = dist_sq(cx, cy, tx, ty);
            if (d < bestDist) {
                bestDist = d;
                bestDx = 0;
                bestDy = -1;
            }
        }
    }
    
    // 2. South (0, 1)
    cx = ent.x;
    cy = ent.y + 1;
    if (check_bounds(cx, cy)) {
        let col = MEM8[calc_collision_addr(cx, cy)];
        let is_valid = 0;
        if (col == 0) { is_valid = 1; }
        else if (cx == tx) { if (cy == ty) { is_valid = 1; } }

        if (is_valid) {
            let d = dist_sq(cx, cy, tx, ty);
            if (d < bestDist) {
                bestDist = d;
                bestDx = 0;
                bestDy = 1;
            }
        }
    }
    
    // 3. West (-1, 0)
    cx = ent.x - 1;
    cy = ent.y;
    if (check_bounds(cx, cy)) {
        let col = MEM8[calc_collision_addr(cx, cy)];
        let is_valid = 0;
        if (col == 0) { is_valid = 1; }
        else if (cx == tx) { if (cy == ty) { is_valid = 1; } }
        
        if (is_valid) {
            let d = dist_sq(cx, cy, tx, ty);
            if (d < bestDist) {
                bestDist = d;
                bestDx = -1;
                bestDy = 0;
            }
        }
    }
    
    // 4. East (1, 0)
    cx = ent.x + 1;
    cy = ent.y;
    if (check_bounds(cx, cy)) {
        let col = MEM8[calc_collision_addr(cx, cy)];
        let is_valid = 0;
        if (col == 0) { is_valid = 1; }
        else if (cx == tx) { if (cy == ty) { is_valid = 1; } }
        
        if (is_valid) {
            let d = dist_sq(cx, cy, tx, ty);
            if (d < bestDist) {
                bestDist = d;
                bestDx = 1;
                bestDy = 0;
            }
        }
    }
    
    // If we found a better step
    if (bestDx != 0) {
        move_entity(id, bestDx, bestDy);
    } else if (bestDy != 0) {
        move_entity(id, bestDx, bestDy);
    }
}

function handle_events() {
  if (M_TARGET == K_PHYSICS || M_TARGET == 0) {
     if (M_OP == REQ_MOVE) {
        move_entity(M_P1, M_P2, M_P3);
     }
     if (M_OP == REQ_PATH_STEP) {
        // P1=ID, P2=TargetX, P3=TargetY
        move_towards(M_P1, M_P2, M_P3);
     }
     if (M_OP == EVT_DEATH) {
        kill_entity(M_P1);
     }
     if (M_OP == CMD_PICKUP) {
        // P1=PlayerID, P2=PlayerX, P3=PlayerY
        try_pickup(M_P1, M_P2, M_P3);
     }
     if (M_OP == REQ_TERRAIN) {
         // Map Gen calls this: P1=X, P2=Y, P3=Packed
         // AJS: load_tile(x, y, color, char, type)
         // But here we need to unpack P3 or expect 5 args? 
         // Actually MapGen calls LOAD_TILE directly via Host, not Bus.
         // This Opcode is for dynamic terrain modification.
     }
  }
}
`;

const BLOCK_ENV = `
: RUN_ENV_CYCLE ;
`;

export const GRID_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  BLOCK_MEMORY,
  BLOCK_UTILS,
  // BLOCK_MAP_DATA removed - migrated to AJS
  AetherTranspiler.transpile(AJS_LOGIC),
  BLOCK_STANDARD_INBOX,
  BLOCK_ENV
];

// IDE EXPORTS
export const GRID_AJS_SOURCE = AJS_LOGIC;
export const GRID_FORTH_SOURCE = [
  BLOCK_MEMORY,
  BLOCK_UTILS,
  "( %%%_AJS_INJECTION_%%% )",
  BLOCK_STANDARD_INBOX
].join("\n");
