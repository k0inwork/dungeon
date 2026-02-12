
// Aethelgard Hive AI Kernel v2.6 (AJS HYBRID)
import { STANDARD_KERNEL_FIRMWARE, BLOCK_STANDARD_INBOX } from "./SharedBlocks";
import { AetherTranspiler } from "../compiler/AetherTranspiler";

const BLOCK_MEMORY = `
HEX
90000 CONSTANT HIVE_ENT_TABLE
DECIMAL
16 CONSTANT ENT_SIZE
32 CONSTANT MAX_ENTITIES
VARIABLE HIVE_ENT_COUNT
0 HIVE_ENT_COUNT !
VARIABLE RNG_SEED
12345 RNG_SEED !
VARIABLE LAST_PLAYER_X
0 LAST_PLAYER_X !
VARIABLE LAST_PLAYER_Y
0 LAST_PLAYER_Y !

: INIT_HIVE
  0 HIVE_ENT_COUNT !
  S" [HIVE] Memory Reset" S.
;

: RANDOM ( -- n )
  RNG_SEED @ 1103515245 * 12345 + DUP RNG_SEED ! 16 RSHIFT 32767 AND
;
`;

const AJS_LOGIC = `
struct HiveEntity {
    x,
    y,
    type
}

function get_hive_ptr(id) {
    return HIVE_ENT_TABLE + (id * SIZEOF_HIVEENTITY);
}

function update_hive_entity(id, x, y) {
  let ent = get_hive_ptr(id);
  ent.x = x;
  ent.y = y;
  
  // Track Max ID saw
  let next = id + 1;
  let current = HIVE_ENT_COUNT; 
  if (next > current) {
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
  if (m == 1) return 1; // East
  if (m == 2) return -1; // West
  return 0;
}

function rand_dir_y() {
  let r = Random();
  let m = r % 4;
  if (m == 0) return -1; // North
  if (m == 3) return 1; // South
  return 0;
}

function abs(n) {
    if (n < 0) return 0 - n;
    return n;
}

function decide_action(id) {
  let ent = get_hive_ptr(id);
  
  // Type 3 = ITEM (Inanimate). Do nothing.
  if (ent.type == 3) {
      return;
  }
  
  if (ent.type == 2) {
      // AGGRESSIVE (Chase Player)
      // Calculate distance to Player
      let dx = abs(ent.x - LAST_PLAYER_X);
      let dy = abs(ent.y - LAST_PLAYER_Y);
      let dist = dx + dy; // Manhattan Distance
      
      // AI Logic: Chase if within 10 tiles
      if (dist < 10) {
         // Request Grid to Pathfind 1 Step
         Bus.send(REQ_PATH_STEP, K_HIVE, K_PHYSICS, id, LAST_PLAYER_X, LAST_PLAYER_Y);
      } else {
         // Random Walk if far away
         let rdx = rand_dir_x();
         let rdy = rand_dir_y();
         Bus.send(REQ_MOVE, K_HIVE, K_PHYSICS, id, rdx, rdy);
      }
  } else {
      // PASSIVE (Random Walk)
      // 50% chance to stand still
      let r = Random();
      let m = r % 100;
      if (m < 50) {
         let rdx = rand_dir_x();
         let rdy = rand_dir_y();
         Bus.send(REQ_MOVE, K_HIVE, K_PHYSICS, id, rdx, rdy);
      }
  }
}

function handle_events() {
  if (M_OP == EVT_MOVED) {
     update_hive_entity(M_P1, M_P2, M_P3);
     
     // Update Global Player Position Cache if ID is 0
     if (M_P1 == 0) {
         LAST_PLAYER_X = M_P2;
         LAST_PLAYER_Y = M_P3;
     }
  }
  
  if (M_OP == EVT_SPAWN) {
      // M_P1 = ID, M_P2 = TYPE (1=Passive, 2=Aggressive, 3=Item)
      set_hive_type(M_P1, M_P2);
      if (M_P2 == 2) {
          Log("[HIVE] Aggressive Entity Registered");
      }
  }
  
  if (M_OP == EVT_COLLIDE) {
     // Collision Event from Bus
     // M_P1 = SourceID (Who moved)
     // M_P2 = TargetID (Who was hit)
     // M_P3 = Type (1 = Entity)
     
     if (M_P3 == 1) {
        // If a Monster (Source > 0) hit Player (0)
        if (M_P1 > 0) {
            if (M_P2 == 0) {
               Log("Enemy Attacks Player!");
               Bus.send(CMD_ATTACK, K_HIVE, K_BUS, M_P1, M_P2, 0);
            }
        }
     }
  }
}

function run_cycle() {
   let i = 1;
   let count = HIVE_ENT_COUNT;
   
   while (i < count) {
      decide_action(i);
      i++;
   }
}
`;

const BLOCK_CYCLE = `
( FIX: Process Inbox to receive Spawn Events BEFORE running Logic )
: RUN_HIVE_CYCLE 
  PROCESS_INBOX 
  RUN_CYCLE 
;
`;

export const HIVE_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  BLOCK_MEMORY,
  AetherTranspiler.transpile(AJS_LOGIC),
  BLOCK_STANDARD_INBOX,
  BLOCK_CYCLE
];

// IDE EXPORTS
export const HIVE_AJS_SOURCE = AJS_LOGIC;
export const HIVE_FORTH_SOURCE = [
  BLOCK_MEMORY,
  "( %%%_AJS_INJECTION_%%% )",
  BLOCK_STANDARD_INBOX
].join("\n");
