
// Aethelgard Hive AI Kernel v3.0 (PURE AJS)
import { STANDARD_KERNEL_FIRMWARE } from "./SharedBlocks";
import { STANDARD_AJS_PREAMBLE, STANDARD_AJS_POSTAMBLE } from "./SharedAJS";
import { AetherTranspiler } from "../compiler/AetherTranspiler";
import { KernelID } from "../types/Protocol";

const AJS_LOGIC = `
${STANDARD_AJS_PREAMBLE}

// 1. MEMORY MAP
const HIVE_ENT_TABLE = 0x90000;
const ENT_SIZE = 16;
const MAX_ENTITIES = 32;
let HIVE_ENT_COUNT = 0;
let RNG_SEED = 12345;
let LAST_PLAYER_X = 0;
let LAST_PLAYER_Y = 0;

function Random() {
    RNG_SEED = (RNG_SEED * 1103515245 + 12345);
    return (RNG_SEED >>> 16) & 32767;
}

function init_hive() {
    HIVE_ENT_COUNT = 0;
    Log("[HIVE] Memory Reset");
}

// 2. LOGIC
struct HiveEntity {
    x,
    y,
    type
}

struct RpgEntity {
    hp,
    maxHp,
    atk,
    def,
    level,
    exp,
    state,
    targetId
}

function get_hive_ptr(id) {
    return HiveEntity(id);
}

function update_hive_entity(id, x, y) {
  let ent = get_hive_ptr(id);
  ent.x = x;
  ent.y = y;
  
  let next = id + 1;
  if (next > HIVE_ENT_COUNT) {
      HIVE_ENT_COUNT = next; 
  }
}

function set_hive_type(id, type) {
  let ent = get_hive_ptr(id);
  ent.type = type;
}

function rand_dir_x() {
  let r = Random();
  let m = r % 4;
  if (m == 1) return 1;
  if (m == 2) return -1;
  return 0;
}

function rand_dir_y() {
  let r = Random();
  let m = r % 4;
  if (m == 0) return -1;
  if (m == 3) return 1;
  return 0;
}

function abs(n) {
    if (n < 0) return 0 - n;
    return n;
}

function decide_action(id) {
  let ent = get_hive_ptr(id);
  if (ent.type == 3) return; // Skip items/loot

  let stats = RpgEntity(id);
  if (stats.state == 1) return; // Skip dead entities
  
  if (ent.type == 2) {
      let playerStats = RpgEntity(0);
      if (playerStats.hp < 20) { Log("Target weak! Pressing attack!"); }

      let dx = abs(ent.x - LAST_PLAYER_X);
      let dy = abs(ent.y - LAST_PLAYER_Y);
      let dist = dx + dy;
      
      if (dist < 10) {
         Bus.send(REQ_PATH_STEP, K_HIVE, K_GRID, id, LAST_PLAYER_X, LAST_PLAYER_Y);
      } else {
         let rdx = rand_dir_x();
         let rdy = rand_dir_y();
         Bus.send(REQ_MOVE, K_HIVE, K_GRID, id, rdx, rdy);
      }
  } else {
      let r = Random();
      let m = r % 100;
      if (m < 50) {
         let rdx = rand_dir_x();
         let rdy = rand_dir_y();
         Bus.send(REQ_MOVE, K_HIVE, K_GRID, id, rdx, rdy);
      }
  }
}

function handle_events() {
  if (M_OP == EVT_MOVED) {
     update_hive_entity(M_P1, M_P2, M_P3);
     if (M_P1 == 0) {
         LAST_PLAYER_X = M_P2;
         LAST_PLAYER_Y = M_P3;
     }
  }
  
  if (M_OP == EVT_SPAWN) {
      set_hive_type(M_P1, M_P2);
      if (M_P2 == 2) { Log("[HIVE] Aggressive Entity Registered"); }
  }

  if (M_OP == EVT_DEATH) {
      set_hive_type(M_P1, 3); // Mark as loot/dead to stop processing
  }
  
  if (M_OP == EVT_COLLIDE) {
     if (M_P3 == 1) {
        if (M_P1 > 0) {
            if (M_P2 == 0) {
               Log("Enemy Attacks Player!");
               Bus.send(CMD_ATTACK, K_HIVE, K_BUS, M_P1, M_P2, 0);
            }
        }
     }
  }
}

${STANDARD_AJS_POSTAMBLE}

function run_cycle() {
   let i = 1;
   let count = HIVE_ENT_COUNT;
   while (i < count) {
      decide_action(i);
      i++;
   }
}

function run_hive_cycle() {
    process_inbox();
    run_cycle();
}
`;

export const HIVE_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.HIVE)
];

export const HIVE_AJS_SOURCE = AJS_LOGIC;
export const HIVE_FORTH_SOURCE = HIVE_KERNEL_BLOCKS.join("\n");
