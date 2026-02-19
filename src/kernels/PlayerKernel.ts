
// Aethelgard Player Kernel v3.0 (PURE AJS)
import { STANDARD_KERNEL_FIRMWARE } from "./SharedBlocks";
import { STANDARD_AJS_PREAMBLE, STANDARD_AJS_POSTAMBLE } from "./SharedAJS";
import { AetherTranspiler } from "../compiler/AetherTranspiler";
import { KernelID } from "../types/Protocol";

const AJS_LOGIC = `
${STANDARD_AJS_PREAMBLE}

// 1. MEMORY
const INV_BASE = 0xC0010; // PLAYER_STRUCT + 16
const INVENTORY = new Uint32Array(INV_BASE);

// 2. LOGIC
struct PlayerState {
    hp,
    maxHp,
    gold,
    invCount,
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
    Chan().on(on_player_event);
    Chan("BUS").on(on_bus_event);
    Chan("combat_events").on(on_combat_event);
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
    Log("Picked up Item ID:");
    Log(itemId);
    Log("Inv Count:");
    Log(p.invCount);
}

function on_player_event(op, sender, p1, p2, p3) {
  if (op == EVT_ITEM_GET) {
      if (p1 == 0) {
          Log("Picked up Loot!");
          add_item(p2);
      }
  }

  if (op == CMD_INTERACT) {
      Log("Using Heavy Smash!");
      Chan("BUS") <- [CMD_ATTACK, 0, 1, 1];
  }
}

function on_bus_event(op, sender, p1, p2, p3) {
  if (op == EVT_COLLIDE) {
      if (p1 == 0) {
          if (p3 == 0) {
             Log("Blocked by Wall.");
          } else {
             Log("Player Hits Enemy! Attacking...");
             Chan("BUS") <- [CMD_ATTACK, 0, p2, 0];
          }
      }
  }
}

function on_combat_event(op, sender, p1, p2, p3) {
    if (op == EVT_DAMAGE) {
        if (p1 == 0) {
             Log("You dealt damage!");
        }
        if (p2 == 0) {
             Log("Ouch! You took damage!");
        }
    }
}

function on_quest_event(op, sender, p1, p2, p3) {
    if (op == EVT_DAMAGE) {
        Log("Quest Progress: Aggressive Enemy Defeated!");
    }
}

function handle_events() {
    // Channel listeners are injected here
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
