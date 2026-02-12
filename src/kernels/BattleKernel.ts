
// Aethelgard Battle Kernel v2.0 (PURE AJS)
import { STANDARD_KERNEL_FIRMWARE } from "./SharedBlocks";
import { STANDARD_AJS_PREAMBLE, STANDARD_AJS_POSTAMBLE } from "./SharedAJS";
import { AetherTranspiler } from "../compiler/AetherTranspiler";
import { KernelID } from "../types/Protocol";

const AJS_LOGIC = `
${STANDARD_AJS_PREAMBLE}

// 1. RPG Stats Memory
const RPG_TABLE = 0xA0000;
const MAX_ENTITIES = 32;
const RPG_SIZE = 32;
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
    targetId
}

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

function log_combat(srcId, tgtId, dmg, label) {
    if (srcId == 0) {
        Log("You use "); Log(label);
        Log(" on enemy: "); Log(dmg); Log(" dmg");
    } else {
        Log("Enemy hits YOU for "); Log(dmg); Log(" dmg");
    }
}

function skill_basic_attack(srcId, tgtId) {
    let src = get_rpg_ptr(srcId);
    let tgt = get_rpg_ptr(tgtId);
    
    let dmg = src.atk - tgt.def;
    if (dmg < 1) { dmg = 1; }
    
    tgt.hp -= dmg;
    
    log_combat(srcId, tgtId, dmg, "Attack");
    Bus.send(EVT_DAMAGE, K_BATTLE, K_BUS, tgtId, dmg, 0);
    
    return tgt.hp;
}

function skill_heavy_smash(srcId, tgtId) {
    let src = get_rpg_ptr(srcId);
    let tgt = get_rpg_ptr(tgtId);
    
    // 2.0x Damage, Ignores Defense
    let dmg = src.atk * 2;
    
    tgt.hp -= dmg;
    
    log_combat(srcId, tgtId, dmg, "SMASH");
    Bus.send(EVT_DAMAGE, K_BATTLE, K_BUS, tgtId, dmg, 2); // Type 2 = Crit/Heavy
    
    return tgt.hp;
}

function skill_heal_self(srcId) {
    let src = get_rpg_ptr(srcId);
    let amount = 20;
    src.hp += amount;
    if (src.hp > src.maxHp) { src.hp = src.maxHp; }
    
    Log("You HEAL for "); Log(amount); Log(" HP");
    Bus.send(EVT_DAMAGE, K_BATTLE, K_BUS, srcId, -amount, 4); // Negative Damage = Heal
}

function skill_fireball(srcId, tgtId) {
    let src = get_rpg_ptr(srcId);
    let tgt = get_rpg_ptr(tgtId);
    
    // Ranged Magic Attack
    // Ignores standard DEF, but we'll use a flat damage for now.
    let dmg = 40;
    
    tgt.hp -= dmg;
    
    log_combat(srcId, tgtId, dmg, "FIREBALL");
    Bus.send(EVT_DAMAGE, K_BATTLE, K_BUS, tgtId, dmg, 1); // Type 1 = Thermal
    
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
            Bus.send(EVT_DEATH, K_BATTLE, K_BUS, tgtId, 0, 0);
            Log("Entity Died:");
            Log(tgtId);
            if (tgtId == 0) Log("GAME OVER");
        }
    }
}

function handle_events() {
    if (M_OP == EVT_SPAWN) {
        // M_P1 = ID, M_P2 = Type
        init_stats(M_P1, M_P2);
    }
    
    if (M_OP == CMD_ATTACK) {
        // M_P1 = Attacker, M_P2 = Target, M_P3 = SkillID
        execute_skill(M_P1, M_P2, M_P3);
    }
}

${STANDARD_AJS_POSTAMBLE}

function run_battle_cycle() {
    process_inbox();
}
`;

export const BATTLE_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.BATTLE)
];

export const BATTLE_AJS_SOURCE = AJS_LOGIC;
export const BATTLE_FORTH_SOURCE = BATTLE_KERNEL_BLOCKS.join("\n");
