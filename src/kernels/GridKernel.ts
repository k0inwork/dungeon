
// Aethelgard Grid Physics Kernel v6.0 (PURE AJS)
import { STANDARD_KERNEL_FIRMWARE } from "./SharedBlocks";
import { STANDARD_AJS_PREAMBLE, STANDARD_AJS_POSTAMBLE } from "./SharedAJS";
import { AetherTranspiler } from "../compiler/AetherTranspiler";
import { KernelID } from "../types/Protocol";

const AJS_LOGIC = `
${STANDARD_AJS_PREAMBLE}

// 1. GRID CONSTANTS & MEMORY
const MAP_WIDTH = 40;
const MAP_HEIGHT = 20;
const MAX_ENTITIES = 32;

const COLLISION_MAP = new Uint8Array(0x30000);
const ENTITY_MAP    = new Uint8Array(0x31000);
const LOOT_MAP      = new Uint8Array(0x32000);
const TERRAIN_MAP   = new Uint32Array(0x40000);
const TRANSITION_MAP = new Int32Array(0x45000);
const VRAM          = new Uint32Array(0x80000);

let ENTITY_COUNT = 0;
let CURRENT_LEVEL_ID = 0;

function set_level_id(id) {
    CURRENT_LEVEL_ID = id;
}

// 2. UTILS
function calc_idx(x, y) { return (y * MAP_WIDTH + x); }

function draw_cell(x, y, color, char) {
    VRAM[calc_idx(x, y)] = (color << 8) | char;
}

function redraw_cell(x, y, color, char) {
    draw_cell(x, y, color, char);
}

// 3. LOGIC
struct GridEntity {
    char,
    color,
    y,
    x,
    type
}

let entities = new Array(GridEntity, MAX_ENTITIES, 0x90000);
export entities;

function get_ent_ptr(id) {
    return GridEntity(id);
}

function check_bounds(x, y) {
  if (x < 0) return 0;
  if (x >= MAP_WIDTH) return 0;
  if (y < 0) return 0;
  if (y >= MAP_HEIGHT) return 0;
  return 1;
}

function system_reset_map() {
    let i = 0;
    let total = MAP_WIDTH * MAP_HEIGHT;
    while (i < total) {
        COLLISION_MAP[i] = 0;
        ENTITY_MAP[i] = 0;
        LOOT_MAP[i] = 0;
        TERRAIN_MAP[i] = 0;
        TRANSITION_MAP[i] = -1;
        VRAM[i] = 0;
        draw_cell(i % 40, i / 40, 0, 32);
        i++;
    }

    // Clear Entity Array Memory
    let ei = 0;
    while (ei < MAX_ENTITIES) {
        let ent = get_ent_ptr(ei);
        ent.char = 0;
        ent.color = 0;
        ent.x = 0;
        ent.y = 0;
        ent.type = 0;
        ei++;
    }

    ENTITY_COUNT = 0;
    CURRENT_LEVEL_ID = 0;

    Chan().on(on_grid_request);
    Chan("BUS").on(on_grid_request);

    Log("[GRID] Map Initialized (AJS v7.0)");
}

function load_tile(x, y, color, char, type, target_id) {
    let i = calc_idx(x, y);
    TERRAIN_MAP[i] = (color << 8) | char;
    TRANSITION_MAP[i] = target_id;

    if (type != 0) {
        COLLISION_MAP[i] = 1;
    } else {
        COLLISION_MAP[i] = 0;
    }
    draw_cell(x, y, color, char);
}

function find_entity_at(x, y) {
  if (check_bounds(x, y) == 0) return -1;
  let idx = calc_idx(x, y);
  let val = ENTITY_MAP[idx];
  if (val != 0) return val - 1;
  val = LOOT_MAP[idx];
  if (val != 0) return val - 1;
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

  let i = calc_idx(x, y);
  draw_cell(x, y, color, char);
  
  if (type == 3) {
      LOOT_MAP[i] = ENTITY_COUNT + 1;
  } else {
      ENTITY_MAP[i] = ENTITY_COUNT + 1;
      COLLISION_MAP[i] = 1;
  }
  
  Chan("npc_sync") <- [EVT_SPAWN, ENTITY_COUNT, type, 0];
  Chan("npc_sync") <- [EVT_MOVED, ENTITY_COUNT, x, y];
  ENTITY_COUNT++;
}

function refresh_tile(x, y, skipId) {
    let packed = TERRAIN_MAP[calc_idx(x, y)];
    let char = packed & 255;
    let color = packed >>> 8;
    
    let id = find_entity_at(x, y);
    if (id != -1) {
        if (id != skipId) {
            let ent = get_ent_ptr(id);
            if (ent.char != 0) {
                char = ent.char;
                color = ent.color;
            }
        }
    }
    redraw_cell(x, y, color, char);
}

function move_entity(id, dx, dy) {
  let ent = get_ent_ptr(id);
  if (ent.char == 0 || ent.type == 3) return;

  let tx = ent.x + dx;
  let ty = ent.y + dy;
  if (check_bounds(tx, ty) == 0) return;

  let ti = calc_idx(tx, ty);

  // LEVEL TRANSITION CHECK (For Player, ID 0)
  if (id == 0) {
      let target = TRANSITION_MAP[ti];
      if (target != -1) {
          bus_send(EVT_LEVEL_TRANSITION, K_GRID, K_HOST, target, 0, 0);
          return;
      }
  }

  let col = COLLISION_MAP[ti];
  if (col != 0) {
      let obs = find_entity_at(tx, ty);
      if (obs == -1) {
         bus_send(EVT_COLLIDE, K_GRID, K_BUS, id, 0, 0);
      } else {
         bus_send(EVT_COLLIDE, K_GRID, K_BUS, id, obs, 1);
      }
      return;
  }
  
  let oi = calc_idx(ent.x, ent.y);
  COLLISION_MAP[oi] = 0;
  ENTITY_MAP[oi] = 0;
  refresh_tile(ent.x, ent.y, id);

  ent.x = tx;
  ent.y = ty;
  COLLISION_MAP[ti] = 1;
  ENTITY_MAP[ti] = id + 1;

  redraw_cell(tx, ty, ent.color, ent.char);
  Chan("npc_sync") <- [EVT_MOVED, id, tx, ty];
}

function kill_entity(id, itemId) {
    let ent = get_ent_ptr(id);
    let ex = ent.x;
    let ey = ent.y;
    let i = calc_idx(ex, ey);

    COLLISION_MAP[i] = 0;
    ENTITY_MAP[i] = 0;
    LOOT_MAP[i] = id + 1;
    // Keep character (e.g. 'r' or 'R'), change color to gray
    ent.color = 8947848; // 0x888888 in decimal
    ent.type = 3; // ITEM
    redraw_cell(ex, ey, ent.color, ent.char);
    Log("[GRID] Entity Died (Corpse)");

    // Pop Item if present
    if (itemId != 0) {
        // Try to spawn Gold Coin ($ = 36, Color Gold = 16766720)
        // at an adjacent passable tile
        let found = 0;
        let tx = ex + 1; let ty = ey;
        if (check_bounds(tx, ty) && COLLISION_MAP[calc_idx(tx, ty)] == 0) { found = 1; }
        else {
            tx = ex - 1; ty = ey;
            if (check_bounds(tx, ty) && COLLISION_MAP[calc_idx(tx, ty)] == 0) { found = 1; }
            else {
                tx = ex; ty = ey + 1;
                if (check_bounds(tx, ty) && COLLISION_MAP[calc_idx(tx, ty)] == 0) { found = 1; }
                else {
                    tx = ex; ty = ey - 1;
                    if (check_bounds(tx, ty) && COLLISION_MAP[calc_idx(tx, ty)] == 0) { found = 1; }
                }
            }
        }

        if (found) {
            spawn_entity(tx, ty, 16766720, 36, 3);
            Log("[GRID] Item Popped on Ground!");
        }
    }
}

function try_pickup(playerId, x, y) {
    let idx = calc_idx(x, y);
    let val = LOOT_MAP[idx];
    if (val != 0) {
        let id = val - 1;
        let ent = get_ent_ptr(id);
        if (ent.char != 0 && ent.type == 3) {
            // Big Rat ('R' = 82) gives multiple items
            if (ent.char == 82) {
                bus_send(EVT_ITEM_GET, K_GRID, K_PLAYER, playerId, 2001, 0); // Tooth
                bus_send(EVT_ITEM_GET, K_GRID, K_PLAYER, playerId, 2002, 0); // Tail
            } else {
                bus_send(EVT_ITEM_GET, K_GRID, K_PLAYER, playerId, id, 0);
            }

            ent.char = 0;
            ent.x = -1;
            ent.y = -1;
            LOOT_MAP[idx] = 0;
            refresh_tile(x, y, -1);
            return;
        }
    }
}

function dist_sq(x1, y1, x2, y2) {
    let dx = x1 - x2;
    let dy = y1 - y2;
    return (dx * dx) + (dy * dy);
}

function move_towards(id, tx, ty) {
    let ent = get_ent_ptr(id);
    let bestDist = dist_sq(ent.x, ent.y, tx, ty);
    let bestDx = 0;
    let bestDy = 0;
    
    // North
    let cx = ent.x;
    let cy = ent.y - 1;
    if (check_bounds(cx, cy)) {
        let col = COLLISION_MAP[calc_idx(cx, cy)];
        if (col == 0 || (cx == tx && cy == ty)) {
            let d = dist_sq(cx, cy, tx, ty);
            if (d < bestDist) { bestDist = d; bestDx = 0; bestDy = -1; }
        }
    }
    // South
    cx = ent.x; cy = ent.y + 1;
    if (check_bounds(cx, cy)) {
        let col = COLLISION_MAP[calc_idx(cx, cy)];
        if (col == 0 || (cx == tx && cy == ty)) {
            let d = dist_sq(cx, cy, tx, ty);
            if (d < bestDist) { bestDist = d; bestDx = 0; bestDy = 1; }
        }
    }
    // West
    cx = ent.x - 1; cy = ent.y;
    if (check_bounds(cx, cy)) {
        let col = COLLISION_MAP[calc_idx(cx, cy)];
        if (col == 0 || (cx == tx && cy == ty)) {
            let d = dist_sq(cx, cy, tx, ty);
            if (d < bestDist) { bestDist = d; bestDx = -1; bestDy = 0; }
        }
    }
    // East
    cx = ent.x + 1; cy = ent.y;
    if (check_bounds(cx, cy)) {
        let col = COLLISION_MAP[calc_idx(cx, cy)];
        if (col == 0 || (cx == tx && cy == ty)) {
            let d = dist_sq(cx, cy, tx, ty);
            if (d < bestDist) { bestDist = d; bestDx = 1; bestDy = 0; }
        }
    }
    
    if (bestDx != 0 || bestDy != 0) {
        move_entity(id, bestDx, bestDy);
    }
}

function teleport_entity(id, tx, ty) {
  let ent = get_ent_ptr(id);
  if (ent.char == 0) return;
  if (check_bounds(tx, ty) == 0) return;

  let oi = calc_idx(ent.x, ent.y);
  if (ent.type != 3) {
      COLLISION_MAP[oi] = 0;
      ENTITY_MAP[oi] = 0;
  }
  refresh_tile(ent.x, ent.y, id);

  ent.x = tx;
  ent.y = ty;
  let ti = calc_idx(tx, ty);
  if (ent.type != 3) {
      COLLISION_MAP[ti] = 1;
      ENTITY_MAP[ti] = id + 1;
  }
  redraw_cell(tx, ty, ent.color, ent.char);
  Chan("npc_sync") <- [EVT_MOVED, id, tx, ty];
}

function teleport_player(tx, ty) {
  teleport_entity(0, tx, ty);
}

function on_grid_request(op, sender, p1, p2, p3) {
    if (op == REQ_MOVE) { move_entity(p1, p2, p3); }
    if (op == REQ_TELEPORT) { teleport_entity(p1, p2, p3); }
    if (op == REQ_PATH_STEP) { move_towards(p1, p2, p3); }
    if (op == EVT_DEATH) { kill_entity(p1, p2); }
    if (op == CMD_PICKUP) { try_pickup(p1, p2, p3); }
}

function handle_events() {
    // Channel listeners are injected here
}

${STANDARD_AJS_POSTAMBLE}


function run_env_cycle() {
    // Empty for now
}

function redraw_all() {
    let i = 0;
    let total = MAP_WIDTH * MAP_HEIGHT;
    while (i < total) {
        let x = i % MAP_WIDTH;
        let y = i / MAP_WIDTH;
        let packed = TERRAIN_MAP[i];
        let char = packed & 255;
        let color = packed >>> 8;

        let val = ENTITY_MAP[i];
        if (val != 0) {
            let ent = GridEntity(val - 1);
            char = ent.char;
            color = ent.color;
        } else {
            val = LOOT_MAP[i];
            if (val != 0) {
                let ent = GridEntity(val - 1);
                char = ent.char;
                color = ent.color;
            }
        }
        VRAM[i] = (color << 8) | char;
        i++;
    }
}
`;

export const GRID_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.GRID),
  ": RUN_GRID_CYCLE PROCESS_INBOX RUN_ENV_CYCLE ;",
  ": SET_LEVEL_ID SET_LEVEL_ID ;",
  ": INIT_MAP SYSTEM_RESET_MAP AJS_INIT_CHANNELS ;",
  ": LOAD_TILE LOAD_TILE ;",
  ": REDRAW_ALL REDRAW_ALL ;",
  ": CMD_TELEPORT TELEPORT_PLAYER ;"
];

export const GRID_AJS_SOURCE = AJS_LOGIC;
export const GRID_FORTH_SOURCE = GRID_KERNEL_BLOCKS.join("\n");
