
// Aethelgard Hive AI Kernel v3.0 (PURE AJS)
import { STANDARD_KERNEL_FIRMWARE } from "./SharedBlocks";
import { STANDARD_AJS_PREAMBLE, STANDARD_AJS_POSTAMBLE } from "./SharedAJS";
import { AetherTranspiler } from "../compiler/AetherTranspiler";
import { KernelID } from "../types/Protocol";

const AJS_LOGIC = `
${STANDARD_AJS_PREAMBLE}

// 1. MEMORY MAP
const MAX_ENTITIES = 32;
let HIVE_ENT_COUNT = 0;
let RNG_SEED = 12345;
let LAST_PLAYER_X = 0;
let LAST_PLAYER_Y = 0;

function Random() {
    RNG_SEED = (RNG_SEED * 1103515245 + 12345);
    return (RNG_SEED >>> 16) & 32767;
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
    targetId,
    invItem
}
let hive_entities = new Array(HiveEntity, MAX_ENTITIES, 0x90000);
export hive_entities;

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

function on_npc_sync(opcode, sender, arg1, arg2, arg3) {
  if (opcode == EVT_MOVED) {
     update_hive_entity(arg1, arg2, arg3);
     if (arg1 == 0) {
         LAST_PLAYER_X = arg2;
         LAST_PLAYER_Y = arg3;
         Log("[HIVE] Player Moved to: "); Log(arg2); Log(","); Log(arg3);
     }
  }

  if (opcode == EVT_SPAWN) {
      set_hive_type(arg1, arg2);
      if (arg2 == 2) { Log("[HIVE] Aggressive Entity Registered"); }
  }

  if (opcode == EVT_DEATH) {
      set_hive_type(arg1, 3); // Mark as loot/dead to stop processing
  }
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
      
      if (dist < 20) {
         Chan("GRID") <- [REQ_PATH_STEP, id, LAST_PLAYER_X, LAST_PLAYER_Y];
      } else {
         let rdx = rand_dir_x();
         let rdy = rand_dir_y();
         Chan("GRID") <- [REQ_MOVE, id, rdx, rdy];
      }
  } else {
      let r = Random();
      let m = r % 100;
      if (m < 50) {
         let rdx = rand_dir_x();
         let rdy = rand_dir_y();
         Chan("GRID") <- [REQ_MOVE, id, rdx, rdy];
      }
  }
}

function on_bus_event(op, sender, p1, p2, p3) {
  if (op == EVT_COLLIDE) {
     if (p3 == 1) {
        if (p1 > 0) {
            if (p2 == 0) {
               Log("Enemy Attacks Player!");
               Chan("BUS") <- [CMD_ATTACK, p1, p2, 0];
            }
        }
     }
  }
}

function handle_events() {
    // Channel listeners are injected here
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

function run_hive_step() {
    process_inbox();
    run_cycle();
}

function init_hive_logic() {
    let i = 0;
    while (i < MAX_ENTITIES) {
        let ent = get_hive_ptr(i);
        ent.x = 0;
        ent.y = 0;
        ent.type = 0;
        i++;
    }
    HIVE_ENT_COUNT = 0;

    Log("[HIVE] Memory Reset");
    Chan("npc_sync").on(on_npc_sync);
    Chan().on(on_bus_event);
    Chan("BUS").on(on_bus_event);

}
`;

export const HIVE_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.HIVE),
  ": INIT_HIVE INIT_HIVE_LOGIC AJS_INIT_CHANNELS ;",
  ": RUN_HIVE_CYCLE RUN_HIVE_STEP ;"
];

export const HIVE_AJS_SOURCE = AJS_LOGIC;
export const HIVE_FORTH_SOURCE = HIVE_KERNEL_BLOCKS.join("\n");
