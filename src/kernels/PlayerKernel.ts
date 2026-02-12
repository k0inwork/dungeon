
// Aethelgard Player Kernel v2.5 (AJS HYBRID)
import { STANDARD_KERNEL_FIRMWARE, BLOCK_STANDARD_INBOX } from "./SharedBlocks";
import { AetherTranspiler } from "../compiler/AetherTranspiler";
import { KernelID } from "../types/Protocol";

const BLOCK_MEMORY = `
HEX
C0000 CONSTANT PLAYER_STRUCT
DECIMAL
`;

const AJS_LOGIC = `
struct PlayerState {
    hp,
    maxHp,
    gold,
    invCount,
    inv0, inv1, inv2, inv3, inv4,
    inv5, inv6, inv7, inv8, inv9
}

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
    
    // Array access using pointer arithmetic logic
    // INV starts at offset 4 (4 ints in: hp, max, gold, count)
    // Actually, transpiler handles offsets.
    // We can't do p.inv[i] yet easily, so manual slot checks or direct mem access
    
    let base = PLAYER_STRUCT + 16; // Skip 4 ints (4*4=16)
    let offset = p.invCount * 4;
    let slotAddr = base + offset;
    MEM32[slotAddr] = itemId;
    
    p.invCount++;
    Log("Item Added. Count:");
    Log(p.invCount);
}

function handle_events() {
  if (M_OP == EVT_SPAWN) {
     // Run init on first spawn event? Or host calls it?
     // Host can call init_player()
  }

  if (M_OP == EVT_COLLIDE) {
      // Check if Player (0) is the source of collision
      if (M_P1 == 0) {
          if (M_P3 == 0) {
             Log("Blocked by Wall.");
          } else {
             Log("Player Hits Enemy! Attacking...");
             // Attack Entity (M_P2) with Basic Attack (Skill 0)
             Bus.send(CMD_ATTACK, K_PLAYER, K_BUS, 0, M_P2, 0);
          }
      }
  }
  
  // Item Acquired Event (Specific to Player)
  if (M_OP == EVT_ITEM_GET) {
      // Check if this event is meant for Player (Target == 2)
      if (M_P1 == 0) {
          Log("Picked up Loot!");
          add_item(M_P2); // M_P2 is ItemID
      }
  }
  
  // Listen for User Input Actions (Mapped from Keypress in Host)
  if (M_OP == CMD_INTERACT) {
      Log("Using Heavy Smash!");
      Bus.send(CMD_ATTACK, K_PLAYER, K_BUS, 0, 1, 1);
  }
}
`;

// Helper to ensure init runs
const BLOCK_INIT_HOOK = `
: PLAYER_BOOT
  INIT_PLAYER
;
`;

export const PLAYER_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  BLOCK_MEMORY,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.PLAYER),
  BLOCK_STANDARD_INBOX,
  BLOCK_INIT_HOOK
];

// IDE EXPORTS
export const PLAYER_AJS_SOURCE = AJS_LOGIC;
export const PLAYER_FORTH_SOURCE = [
  BLOCK_MEMORY,
  "( %%%_AJS_INJECTION_%%% )",
  BLOCK_STANDARD_INBOX
].join("\n");
