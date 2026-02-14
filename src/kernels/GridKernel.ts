
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
const TERRAIN_MAP   = new Uint32Array(0x40000);
const VRAM          = new Uint32Array(0x80000);
const TRANSITION_MAP = new Int32Array(0x41000); // 256 entries

let ENTITY_COUNT = 0;

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
    type,
    itemId
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

function init_map() {
    let y = 0;
    while (y < MAP_HEIGHT) {
        let x = 0;
        while (x < MAP_WIDTH) {
            let i = calc_idx(x, y);
            draw_cell(x, y, 0, 32);
            COLLISION_MAP[i] = 0;
            ENTITY_MAP[i] = 0;
            TERRAIN_MAP[i] = 0;
            x++;
        }
        y++;
    }

    let i = 0;
    while (i < 256) {
        TRANSITION_MAP[i] = 0;
        i++;
    }

    ENTITY_COUNT = 0;
    Log("[GRID] Map Initialized (AJS v7.0)");
}

function set_transition(charCode, targetIdx) {
    TRANSITION_MAP[charCode] = targetIdx + 1;
}

function load_tile(x, y, color, char, type) {
    let i = calc_idx(x, y);
    TERRAIN_MAP[i] = (color << 8) | char;

    if (type != 0) {
        COLLISION_MAP[i] = 1;
    } else {
        COLLISION_MAP[i] = 0;
    }
    draw_cell(x, y, color, char);
}

function find_entity_at(x, y) {
  if (check_bounds(x, y) == 0) return -1;
  let val = ENTITY_MAP[calc_idx(x, y)];
  if (val == 0) return -1;
  return val - 1;
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
  ENTITY_MAP[i] = ENTITY_COUNT + 1;
  draw_cell(x, y, color, char);
  
  if (type != 3) {
      COLLISION_MAP[i] = 1;
  }
  
  bus_send(EVT_SPAWN, K_GRID, K_BUS, ENTITY_COUNT, type, 0);
  bus_send(EVT_MOVED, K_GRID, K_BUS, ENTITY_COUNT, x, y);
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
  if (ent.char == 0) return;

  let tx = ent.x + dx;
  let ty = ent.y + dy;
  if (check_bounds(tx, ty) == 0) return;

  let ti = calc_idx(tx, ty);

  // LEVEL TRANSITION CHECK (For Player, ID 0)
  if (id == 0) {
      let packed = TERRAIN_MAP[ti];
      let char = packed & 255;
      let targetIdxPlusOne = TRANSITION_MAP[char];
      if (targetIdxPlusOne != 0) {
          bus_send(EVT_LEVEL_TRANSITION, K_GRID, K_HOST, targetIdxPlusOne - 1, 0, 0);
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
  bus_send(EVT_MOVED, K_GRID, K_BUS, id, tx, ty);
}

function kill_entity(id) {
    let ent = get_ent_ptr(id);
    let stats = RpgEntity(id);

    COLLISION_MAP[calc_idx(ent.x, ent.y)] = 0;
    ent.char = 36; // '$'
    ent.color = 16766720; 
    ent.type = 3;
    ent.itemId = stats.invItem;

    redraw_cell(ent.x, ent.y, ent.color, ent.char);
    Log("[GRID] Entity Dropped Loot");
}

function try_pickup(playerId, x, y) {
    let id = find_entity_at(x, y);
    if (id != -1) {
        let ent = get_ent_ptr(id);
        if (ent.char != 0) {
            if (ent.type == 3) {
                let droppedItem = ent.itemId;
                ent.char = 0;
                ent.x = -1;
                ent.y = -1;
                ENTITY_MAP[calc_idx(x, y)] = 0;
                refresh_tile(x, y, -1);
                bus_send(EVT_ITEM_GET, K_GRID, K_PLAYER, playerId, droppedItem, 0);
                return;
            }
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

function handle_events() {
  if (M_TARGET == K_GRID || M_TARGET == 0) {
     if (M_OP == REQ_MOVE) { move_entity(M_P1, M_P2, M_P3); }
     if (M_OP == REQ_PATH_STEP) { move_towards(M_P1, M_P2, M_P3); }
     if (M_OP == EVT_DEATH) { kill_entity(M_P1); }
     if (M_OP == CMD_PICKUP) { try_pickup(M_P1, M_P2, M_P3); }
  }
}

${STANDARD_AJS_POSTAMBLE}

function run_env_cycle() {
    // Empty for now
}
`;

export const GRID_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.GRID),
  ": RUN_GRID_CYCLE PROCESS_INBOX RUN_ENV_CYCLE ;"
];

export const GRID_AJS_SOURCE = AJS_LOGIC;
export const GRID_FORTH_SOURCE = GRID_KERNEL_BLOCKS.join("\n");
