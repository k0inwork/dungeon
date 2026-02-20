
// Aethelgard Battle Kernel v2.0 (PURE AJS)
import { STANDARD_KERNEL_FIRMWARE } from "./SharedBlocks";
import { STANDARD_AJS_PREAMBLE, STANDARD_AJS_POSTAMBLE } from "./SharedAJS";
import { AetherTranspiler } from "../compiler/AetherTranspiler";
import { KernelID } from "../types/Protocol";

const AJS_LOGIC = `
${STANDARD_AJS_PREAMBLE}

// 1. RPG Stats Memory
const MAX_ENTITIES = 32;
const RPG_SIZE = 36;
let ENTITY_COUNT = 0;

// 2. LOGIC
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
export rpg_table;

function get_rpg_ptr(id) {
    return RpgEntity(id);
}

function init_stats(id, type) {
    let e = get_rpg_ptr(id);
    
    // Default Stats
    e.maxHp = 100;
    e.hp = 100;
    e.atk = 10;
    e.def = 2;
    e.level = 1;
    e.state = 0; // 0=Alive
    e.invItem = 0;
    
    if (id == 0) {
        // Player Buff
        e.maxHp = 200;
        e.hp = 200;
        e.atk = 20; 
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
    let src = get_rpg_ptr(srcId);
    let tgt = get_rpg_ptr(tgtId);
    
    let dmg = src.atk - tgt.def;
    if (dmg < 1) { dmg = 1; }
    
    tgt.hp -= dmg;
    
    log_combat(srcId, tgtId, dmg);
    Chan("BUS") <- [EVT_DAMAGE, tgtId, dmg, 0];
    
    return tgt.hp;
}

function skill_heavy_smash(srcId, tgtId) {
    let src = get_rpg_ptr(srcId);
    let tgt = get_rpg_ptr(tgtId);
    
    // 2.0x Damage, Ignores Defense
    let dmg = src.atk * 2;
    
    tgt.hp -= dmg;
    
    log_combat(srcId, tgtId, dmg);
    Chan("BUS") <- [EVT_DAMAGE, tgtId, dmg, 2]; // Type 2 = Crit/Heavy
    
    return tgt.hp;
}

function skill_heal_self(srcId) {
    let src = get_rpg_ptr(srcId);
    let amount = 20;
    src.hp += amount;
    if (src.hp > src.maxHp) { src.hp = src.maxHp; }
    
    Log("You HEAL for "); Log(amount); Log(" HP");
    Chan("BUS") <- [EVT_DAMAGE, srcId, -amount, 4]; // Negative Damage = Heal
}

function skill_fireball(srcId, tgtId) {
    let src = get_rpg_ptr(srcId);
    let tgt = get_rpg_ptr(tgtId);
    
    // Ranged Magic Attack
    // Ignores standard DEF, but we'll use a flat damage for now.
    let dmg = 40;
    
    tgt.hp -= dmg;
    
    log_combat(srcId, tgtId, dmg, "FIREBALL");
    Chan("BUS") <- [EVT_DAMAGE, tgtId, dmg, 1]; // Type 1 = Thermal
    
    return tgt.hp;
}

// --- MAIN DISPATCHER ---

function execute_skill(srcId, tgtId, skillId) {
    let remainingHp = 100;
    
    // Check if attacker is valid
    let src = get_rpg_ptr(srcId);
    if (src.state == 1) return;

    // Check if target is valid
    let tgt = get_rpg_ptr(tgtId);
    if (tgt.state == 1) {
        Log("Target already dead.");
        return;
    }
    
    // Simple Dispatch Table
    if (skillId == 0) {
        remainingHp = skill_basic_attack(srcId, tgtId);
    }
    if (skillId == 1) {
        remainingHp = skill_heavy_smash(srcId, tgtId);
    }
    if (skillId == 2) {
        skill_heal_self(srcId);
    }
    if (skillId == 3) {
        remainingHp = skill_fireball(srcId, tgtId);
    }
    
    // Check Death (Common Logic)
    if (remainingHp <= 0) {
        if (tgt.state == 0) { // Only die once
            tgt.state = 1; // Dead
            Chan("BUS") <- [EVT_DEATH, tgtId, tgt.invItem, 0];
            Log("Entity Died:");
            Log(tgtId);
            if (tgtId == 0) Log("GAME OVER");
        }
    }
}

function on_npc_sync(opcode, sender, p1, p2, p3) {
    if (opcode == EVT_SPAWN) {
        init_stats(p1, p2);

        // Assign Inventory for Testing
        let e = get_rpg_ptr(p1);
        if (p2 == 2) { // Big Rats / Aggressive
             e.invItem = 2001;
        } else if (p2 == 1) { // Regular Rats / Passive
             e.invItem = 2003;
        }
    }
}

function on_battle_request(op, sender, p1, p2, p3) {
    if (op == CMD_ATTACK) {
        // p1 = Attacker, p2 = Target, p3 = SkillID
        execute_skill(p1, p2, p3);
    }
}

function init_battle() {
    let i = 0;
    while (i < MAX_ENTITIES) {
        let e = get_rpg_ptr(i);
        e.hp = 0;
        e.maxHp = 0;
        e.atk = 0;
        e.def = 0;
        e.level = 0;
        e.exp = 0;
        e.state = 0;
        e.targetId = 0;
        e.invItem = 0;
        i++;
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

function run_battle_cycle() {
    process_inbox();
}
`;

export const BATTLE_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.BATTLE),
  ": INIT_BATTLE INIT_BATTLE AJS_INIT_CHANNELS ;"
];

export const BATTLE_AJS_SOURCE = AJS_LOGIC;
export const BATTLE_FORTH_SOURCE = BATTLE_KERNEL_BLOCKS.join("\n");
