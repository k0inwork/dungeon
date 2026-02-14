
// Aethelgard Player Kernel v3.0 (PURE AJS)
import { STANDARD_KERNEL_FIRMWARE } from "./SharedBlocks";
import { STANDARD_AJS_PREAMBLE, STANDARD_AJS_POSTAMBLE } from "./SharedAJS";
import { AetherTranspiler } from "../compiler/AetherTranspiler";
import { KernelID } from "../types/Protocol";

const AJS_LOGIC = `
${STANDARD_AJS_PREAMBLE}

// 1. MEMORY
const INV_BASE = 0xC0018; // PLAYER_STRUCT + 24
const INVENTORY = new Uint32Array(INV_BASE);

// 2. LOGIC
struct PlayerState {
    hp,
    maxHp,
    gold,
    invCount,
    x,
    y,
    inv0, inv1, inv2, inv3, inv4,
    inv5, inv6, inv7, inv8, inv9
}

let player_state = new Array(PlayerState, 1, 0xC0000);
export player_state;

function get_player_ptr() {
    return PlayerState(0);
}

function init_player() {
    let p = get_player_ptr();
    p.hp = 100;
    p.maxHp = 100;
    p.gold = 0;
    p.invCount = 0;
    Log("[PLAYER] State Initialized");
}

function add_item(itemId) {
    let p = get_player_ptr();
    if (p.invCount >= 10) {
        Log("Inventory Full!");
        return;
    }
    
    INVENTORY[p.invCount] = itemId;
    
    p.invCount++;
    Log("Item Added. Count:");
    Log(p.invCount);
}

function handle_events() {
  if (M_OP == EVT_SPAWN) {
     if (M_P1 == 0) {
         let p = get_player_ptr();
         p.x = (M_P3 >>> 16) & 255;
         p.y = M_P3 & 255;
     }
  }

  if (M_OP == EVT_MOVED) {
      if (M_P1 == 0) {
          let p = get_player_ptr();
          p.x = M_P2;
          p.y = M_P3;
      }
  }

  if (M_OP == EVT_COLLIDE) {
      if (M_P1 == 0) {
          if (M_P3 == 0) {
             Log("Blocked by Wall.");
          } else {
             Log("Player Hits Enemy! Attacking...");
             bus_send(CMD_ATTACK, K_PLAYER, K_BUS, 0, M_P2, 0);
          }
      }
  }
  
  if (M_OP == EVT_ITEM_GET) {
      if (M_P1 == 0) {
          Log("Picked up Loot!");
          add_item(M_P2);
      }
  }
  
  if (M_OP == CMD_INTERACT) {
      Log("Using Heavy Smash!");
      bus_send(CMD_ATTACK, K_PLAYER, K_BUS, 0, 1, 1);
  }
}

${STANDARD_AJS_POSTAMBLE}

function run_player_cycle() {
    process_inbox();
}

function player_boot() {
    init_player();
}
`;

export const PLAYER_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.PLAYER)
];

export const PLAYER_AJS_SOURCE = AJS_LOGIC;
export const PLAYER_FORTH_SOURCE = PLAYER_KERNEL_BLOCKS.join("\n");
