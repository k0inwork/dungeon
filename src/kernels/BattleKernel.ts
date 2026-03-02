
// Aethelgard Battle Kernel v2.0 (PURE AJS)
import { STANDARD_KERNEL_FIRMWARE, BLOCK_STANDARD_INBOX } from "./SharedBlocks";
import { STANDARD_AJS_PREAMBLE, STANDARD_AJS_POSTAMBLE } from "./SharedAJS";
import { AetherTranspiler } from "../compiler/AetherTranspiler";
import { KernelID } from "../types/Protocol";

const AJS_LOGIC = `
${STANDARD_AJS_PREAMBLE}

// 1. RPG Stats Memory
const MAX_ENTITIES = 32;
const RPG_SIZE = 36;
let ENTITY_COUNT = 0;

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

let rpg_table = new Array(RpgEntity, MAX_ENTITIES, 0xA0000);

// 2. LOGIC

function get_rpg_ptr(id) {
    return RpgEntity(id);
}

function init_stats(id, type) {
    // Default Stats
    rpg_table[id].maxHp = 100;
    rpg_table[id].hp = 100;
    rpg_table[id].atk = 10;
    rpg_table[id].def = 2;
    rpg_table[id].level = 1;
    rpg_table[id].state = 0; // 0=Alive
    rpg_table[id].invItem = 0;
    
    if (id == 0) {
        // Sync from Player Kernel for Persistence
        let p = PlayerState(0);
        if (p.maxHp > 0 && p.maxHp < 100000) {
            rpg_table[0].maxHp = p.maxHp;
            rpg_table[0].hp = p.hp;
        } else {
            rpg_table[0].maxHp = 200;
            rpg_table[0].hp = 200;
        }
        rpg_table[0].atk = 20;
    }
    
    Log("Stats Init for ID:");
    Log(id);
}

// --- SKILL SCRIPTS ---

function log_combat(srcId, tgtId, dmg) {
    if (srcId == 0) {
        Log("You deal damage:"); Log(dmg);
    } else {
        Log("Enemy hits YOU for "); Log(dmg); Log(" dmg");
    }
    Chan("combat_events") <- [EVT_DAMAGE, srcId, tgtId, dmg];
}

function skill_basic_attack(srcId, tgtId) {
    let dmg = rpg_table[srcId].atk - rpg_table[tgtId].def;
    if (dmg < 1) { dmg = 1; }
    
    rpg_table[tgtId].hp -= dmg;
    
    log_combat(srcId, tgtId, dmg);
    Chan("BUS") <- [EVT_DAMAGE, tgtId, dmg, 0];
    
    return rpg_table[tgtId].hp;
}

function skill_heavy_smash(srcId, tgtId) {
    // 2.0x Damage, Ignores Defense
    let dmg = rpg_table[srcId].atk * 2;
    
    rpg_table[tgtId].hp -= dmg;
    
    log_combat(srcId, tgtId, dmg);
    Chan("BUS") <- [EVT_DAMAGE, tgtId, dmg, 2]; // Type 2 = Crit/Heavy
    
    return rpg_table[tgtId].hp;
}

function skill_heal_self(srcId) {
    let amount = 20;
    rpg_table[srcId].hp += amount;
    if (rpg_table[srcId].hp > rpg_table[srcId].maxHp) {
        rpg_table[srcId].hp = rpg_table[srcId].maxHp;
    }
    
    Log("You HEAL for "); Log(amount); Log(" HP");
    Chan("BUS") <- [EVT_DAMAGE, srcId, -amount, 4]; // Negative Damage = Heal
}

function skill_fireball(srcId, tgtId) {
    // Ranged Magic Attack
    let dmg = 40;
    rpg_table[tgtId].hp -= dmg;
    
    log_combat(srcId, tgtId, dmg);
    Chan("BUS") <- [EVT_DAMAGE, tgtId, dmg, 1]; // Type 1 = Thermal
    
    return rpg_table[tgtId].hp;
}

// --- MAIN DISPATCHER ---

function execute_skill(srcId, tgtId, skillId) {
    let remainingHp = 100;
    
    // Check if attacker is valid
    if (rpg_table[srcId].state == 1) return;

    // Check if target is valid
    if (rpg_table[tgtId].state == 1) {
        Log("Target already dead.");
        return;
    }
    
    // Simple Dispatch Table
    switch(skillId) {
        case 0:
            remainingHp = skill_basic_attack(srcId, tgtId);
            break;
        case 1:
            remainingHp = skill_heavy_smash(srcId, tgtId);
            break;
        case 2:
            skill_heal_self(srcId);
            break;
        case 3:
            remainingHp = skill_fireball(srcId, tgtId);
            break;
    }
    
    // Check Death (Common Logic)
    if (remainingHp <= 0) {
        if (rpg_table[tgtId].state == 0) { // Only die once
            rpg_table[tgtId].state = 1; // Dead
            Chan("BUS") <- [EVT_DEATH, tgtId, rpg_table[tgtId].invItem, 0];
            Log("Entity Died:");
            Log(tgtId);
            if (tgtId == 0) Log("GAME OVER");
        }
    }
}

function on_npc_sync(opcode, sender, p1, p2, p3) {
    switch(opcode) {
        case EVT_SPAWN:
            init_stats(p1, p2);

            // Assign Inventory for Testing
            if (p2 == 2) { // Big Rats / Aggressive
                 rpg_table[p1].invItem = 2001;
            } else if (p2 == 1) { // Regular Rats / Passive
                 rpg_table[p1].invItem = 2003;
            }
            break;
    }
}

function on_battle_request(op, sender, p1, p2, p3) {
    switch(op) {
        case CMD_ATTACK:
            // p1 = Attacker, p2 = Target, p3 = SkillID
            execute_skill(p1, p2, p3);
            break;
    }
}

function init_battle_logic() {
    for (let i = 0; i < MAX_ENTITIES; i++) {
        rpg_table[i].hp = 0;
        rpg_table[i].maxHp = 0;
        rpg_table[i].atk = 0;
        rpg_table[i].def = 0;
        rpg_table[i].level = 0;
        rpg_table[i].exp = 0;
        rpg_table[i].state = 0;
        rpg_table[i].targetId = 0;
        rpg_table[i].invItem = 0;
    }
    ENTITY_COUNT = 0;

    Log("[BATTLE] Battle Kernel Initialized");
    Chan("npc_sync").on(on_npc_sync);
    Chan().on(on_battle_request);
    Chan("BUS").on(on_battle_request);

}

function handle_events() {
    // Channel listeners are injected here
}

${STANDARD_AJS_POSTAMBLE}

function run_battle_step() {
    process_inbox();
}
`;

export const BATTLE_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  BLOCK_STANDARD_INBOX,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.BATTLE),
  ": INIT_BATTLE INIT_BATTLE_LOGIC AJS_INIT_CHANNELS ' HANDLE_EVENTS HANDLE_EVENTS_XT ! ;",
  ": RUN_BATTLE_CYCLE RUN_BATTLE_STEP ;"
];

export const BATTLE_AJS_SOURCE = AJS_LOGIC;
export const BATTLE_FORTH_SOURCE = BATTLE_KERNEL_BLOCKS.join("\n");
