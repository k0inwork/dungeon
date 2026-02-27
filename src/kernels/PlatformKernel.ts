
import { STANDARD_KERNEL_FIRMWARE, BLOCK_STANDARD_INBOX } from "./SharedBlocks";
import { STANDARD_AJS_PREAMBLE, STANDARD_AJS_POSTAMBLE } from "./SharedAJS";
import { AetherTranspiler } from "../compiler/AetherTranspiler";
import { KernelID } from "../types/Protocol";

const AJS_LOGIC = `
${STANDARD_AJS_PREAMBLE}

const MAP_WIDTH = 40;
const MAP_HEIGHT = 20;

const COLLISION_MAP = new Uint8Array(0x30000);
const TERRAIN_MAP   = new Uint32Array(0x40000);
const TRANSITION_MAP = new Int32Array(0x45000);
const VRAM          = new Uint32Array(0x80000);

const MAX_ENTITIES = 32;

struct PlatEntity {
    char,
    color,
    py,
    px,
    ptype
}

struct PlatPhysics {
    vx,
    vy,
    fx,
    fy,
    active,
    cooldown
}

let entities = new Array(PlatEntity, MAX_ENTITIES, 0x90000);
let physics  = new Array(PlatPhysics, MAX_ENTITIES, 0x95000);

let ENTITY_COUNT = 0;
let RNG_SEED = 12345;
let skill_timer = 0;

function Random() {
    RNG_SEED = (RNG_SEED * 1103515245 + 12345);
    return (RNG_SEED >>> 16) & 32767;
}

function abs(n) {
    if (n < 0) return 0 - n;
    return n;
}

let gravity = 5000;
let jump_force = -75000;
let move_speed = 20000;

let CURRENT_LEVEL_ID = 0;

function set_level_id(id) {
    CURRENT_LEVEL_ID = id;
}

function calc_idx(x, y) { return (y * MAP_WIDTH + x); }

function get_collision(cx, cy) {
    if (cx < 0) return 1;
    if (cx >= MAP_WIDTH) return 1;
    if (cy < 0) return 0;
    if (cy >= MAP_HEIGHT) return 1;
    return COLLISION_MAP[calc_idx(cx, cy)];
}


function update_entity_physics(id) {
    if (physics[id].active == 0) return;

    // Apply Gravity
    physics[id].vy = physics[id].vy + gravity;
    if (id == 0) {
        physics[id].vx = (physics[id].vx * 8) / 10; // friction for player
    } else {
        physics[id].vx = (physics[id].vx * 9) / 10; // friction for others
    }

    let nx = physics[id].fx + physics[id].vx;
    let ny = physics[id].fy + physics[id].vy;

    let lx = (physics[id].fx + 4000) / 65536;
    let rx = (physics[id].fx + 61536) / 65536;

    // 1. Vertical Collision
    let by_foot = (ny + 65535) / 65536;
    let by_head = ny / 65536;

    if (physics[id].vy > 0) {
        if (get_collision(lx, by_foot) || get_collision(rx, by_foot)) {
            physics[id].vy = 0;
            physics[id].fy = (by_foot - 1) * 65536;
            ny = physics[id].fy;
        } else {
            physics[id].fy = ny;
        }
    } else if (physics[id].vy < 0) {
        if (get_collision(lx, by_head) || get_collision(rx, by_head)) {
            physics[id].vy = 0;
            physics[id].fy = (by_head + 1) * 65536;
            ny = physics[id].fy;
        } else {
            physics[id].fy = ny;
        }
    } else {
        physics[id].fy = ny;
    }

    // 2. Horizontal Collision (using updated FY)
    let h_rx = (nx + 63536) / 65536;
    let h_lx = (nx + 2000) / 65536;
    let pyy = physics[id].fy / 65536;

    if (physics[id].vx > 0) {
        if (get_collision(h_rx, pyy)) {
            physics[id].vx = 0;
            physics[id].fx = (h_rx - 1) * 65536;
        } else {
            physics[id].fx = nx;
        }
    } else if (physics[id].vx < 0) {
        if (get_collision(h_lx, pyy)) {
            physics[id].vx = 0;
            physics[id].fx = (h_lx + 1) * 65536;
        } else {
            physics[id].fx = nx;
        }
    }

    // Bounds clamp
    if (physics[id].fx < 0) physics[id].fx = 0;
    if (physics[id].fy < 0) physics[id].fy = 0;
    if (physics[id].fx > 39 * 65536) physics[id].fx = 39 * 65536;
    if (physics[id].fy > 19 * 65536) physics[id].fy = 19 * 65536;

    // Sync GridEntity for render/host
    entities[id].px = Math.floor(physics[id].fx / 65536);
    entities[id].py = Math.floor(physics[id].fy / 65536);

    // Player specific (Exit check)
    if (id == 0) {
        let exit_idx = calc_idx(entities[id].px, entities[id].py);
        let exit_target = TRANSITION_MAP[exit_idx];
        if (exit_target != -1) {
            bus_send(EVT_LEVEL_TRANSITION, K_PLATFORM, K_HOST, exit_target, 0, 0);
            physics[id].fx = 5 * 65536; // reset pos
        }
    }
}

function frog_ai(id) {
    let r = Random() % 100;

    if (entities[id].ptype == 1) { // passive frog 'f'
        if (r < 2) {
            if (get_collision(entities[id].px, entities[id].py + 1)) {
                physics[id].vy = jump_force / 2;
                physics[id].vx = (Random() % 20000) - 10000;
            }
        }
    } else if (entities[id].ptype == 2) { // aggressive frog 'F'
        let dx = physics[0].fx - physics[id].fx;
        let dy = physics[0].fy - physics[id].fy;
        let dist_x = abs(dx / 65536);
        let dist_y = abs(dy / 65536);

        if (dist_x < 15) {
            // Horizontal Pursuit
            if (dx > 32768) {
                physics[id].vx = physics[id].vx + 2000;
            } else if (dx < -32768) {
                physics[id].vx = physics[id].vx - 2000;
            }

            // Occasional Jump
            if (r < 3) {
                if (get_collision(entities[id].px, entities[id].py + 1)) {
                    physics[id].vy = jump_force / 2;
                }
            }
        }
    }
}

function check_player_stomps() {
    if (physics[0].vy <= 0) return;

    let i = 1;
    while (i < ENTITY_COUNT) {
        if (physics[i].active) {
            if (entities[i].ptype == 1 || entities[i].ptype == 2) {
                let dx = abs(physics[0].fx - physics[i].fx);
                let dy = physics[0].fy - physics[i].fy;
                if (dx < 40000 && dy > -32768 && dy < 32768) {
                    bus_send(EVT_DAMAGE, K_PLATFORM, K_BUS, i, 10, 0);
                    physics[0].vy = jump_force / 2;
                    return;
                }
            }
        }
        i++;
    }
}

function update_physics() {
    update_entity_physics(0);
    check_player_stomps();

    let i = 1;
    while (i < ENTITY_COUNT) {
        if (physics[i].active) {
            update_entity_physics(i);

            // Check Player Contact
            let dx = abs(physics[0].fx - physics[i].fx);
            let dy = abs(physics[0].fy - physics[i].fy);

            if (dx < 40000 && dy < 40000) {
                // 1. Contact Damage (Frogs)
                if (entities[i].ptype == 1 || entities[i].ptype == 2) {
                    if (physics[0].cooldown == 0) {
                        // Deal 7 damage to Player (ID 0)
                        // Send to combat_events channel so PlayerKernel logs and subtracts HP
                        Chan("combat_events") <- [EVT_DAMAGE, i, 0, 7];
                        physics[0].cooldown = 10; // 1 second invincibility
                    }
                }
                // 2. Auto-pickup (Loot)
                if (entities[i].ptype == 3) {
                    bus_send(EVT_ITEM_GET, K_PLATFORM, K_PLAYER, 0, entities[i].char, 0);
                    physics[i].active = 0;
                    entities[i].char = 32; // Clear glyph
                }
            }

            if (entities[i].ptype == 1 || entities[i].ptype == 2) {
                frog_ai(i);
            }
        }
        i++;
    }

    if (physics[0].cooldown > 0) physics[0].cooldown--;
    if (skill_timer > 0) skill_timer--;
}

function spawn_entity_logic(x, y, color, char, type) {
    if (ENTITY_COUNT >= MAX_ENTITIES) return;
    let id = ENTITY_COUNT;
    ENTITY_COUNT++;

    entities[id].char = char;
    entities[id].color = color;
    entities[id].px = x;
    entities[id].py = y;
    entities[id].ptype = type;

    physics[id].fx = x * 65536;
    physics[id].fy = y * 65536;
    physics[id].vx = 0;
    physics[id].vy = 0;
    physics[id].active = 1;

    Chan("npc_sync") <- [EVT_SPAWN, id, type, 0];
    Chan("npc_sync") <- [EVT_MOVED, id, x, y];
}

function trigger_skill() {
    skill_timer = 10;
    let px = Math.floor(physics[0].fx / 65536);
    let py = Math.floor(physics[0].fy / 65536);

    let i = 1;
    while (i < ENTITY_COUNT) {
        if (physics[i].active) {
            if (entities[i].ptype == 1 || entities[i].ptype == 2) {
                let ex = Math.floor(physics[i].fx / 65536);
                let ey = Math.floor(physics[i].fy / 65536);
                let dx = abs(px - ex);
                let dy = abs(py - ey);
                if (dx <= 1 && dy <= 1) {
                    bus_send(EVT_DAMAGE, K_PLATFORM, K_BUS, i, 15, 0);
                }
            }
        }
        i++;
    }
}

function render_logic() {
    let ri = 0;
    let total = MAP_WIDTH * MAP_HEIGHT;
    while (ri < total) {
        VRAM[ri] = TERRAIN_MAP[ri];
        ri++;
    }

    if (skill_timer > 0) {
        let px = Math.floor(physics[0].fx / 65536);
        let py = Math.floor(physics[0].fy / 65536);
        let gx = px - 1;
        while (gx <= px + 1) {
            let gy = py - 1;
            while (gy <= py + 1) {
                if (gx >= 0 && gx < MAP_WIDTH && gy >= 0 && gy < MAP_HEIGHT) {
                    let gidx = calc_idx(gx, gy);
                    let orig = VRAM[gidx];
                    VRAM[gidx] = (0x800080 << 8) | (orig & 255);
                }
                gy++;
            }
            gx++;
        }
    }

    let i = 0;
    while (i < ENTITY_COUNT) {
        if (physics[i].active) {
            let ren_pidx = calc_idx(entities[i].px, entities[i].py);
            if (ren_pidx >= 0 && ren_pidx < total) {
                VRAM[ren_pidx] = (entities[i].color << 8) | entities[i].char;
            }
        }
        i++;
    }
}

function move_player(m_dir) {
    physics[0].vx = physics[0].vx + (m_dir * move_speed);
}

function jump_player() {
    let bx = Math.floor(physics[0].fx / 65536);
    let by = Math.floor(physics[0].fy / 65536) + 1;
    if (get_collision(bx, by) != 0) {
        physics[0].vy = jump_force;
    }
}

function teleport_player(tx, ty) {
    physics[0].fx = tx * 65536;
    physics[0].fy = ty * 65536;
    physics[0].vx = 0;
    physics[0].vy = 0;
}

// Legacy helpers for tests and host
function player_x_val() { return physics[0].fx; }
function player_y_val() { return physics[0].fy; }
function player_vx_val() { return physics[0].vx; }
function player_vy_val() { return physics[0].vy; }

function on_platform_request(op, sender, p1, p2, p3) {
    if (op == REQ_MOVE) { move_player(p1); }
    if (op == REQ_TELEPORT) { teleport_player(p1, p2); }
    if (op == CMD_INTERACT) { trigger_skill(); }
    if (op == EVT_DEATH) {
        if (p1 > 0) {
            physics[p1].active = 0;
            entities[p1].char = 32;
        }
    }
}

function init_platformer_logic() {
    let i = 0;
    let total = MAP_WIDTH * MAP_HEIGHT;
    while (i < total) {
        TERRAIN_MAP[i] = 0;
        COLLISION_MAP[i] = 0;
        TRANSITION_MAP[i] = -1;
        VRAM[i] = 0;
        i++;
    }

    i = 0;
    while (i < MAX_ENTITIES) {
        let p = physics[i];
        p.active = 0;
        p.vx = 0;
        p.vy = 0;
        p.fx = 0;
        p.fy = 0;
        p.cooldown = 0;
        let ent = entities[i];
        ent.char = 0;
        ent.color = 0;
        ent.px = 0;
        ent.py = 0;
        ent.ptype = 0;
        i++;
    }

    ENTITY_COUNT = 0;
    skill_timer = 0;
    CURRENT_LEVEL_ID = 0;
    Chan().on(on_platform_request);
    Chan("BUS").on(on_platform_request);

    Log("[PLATFORM] Kernel Ready (v6-safe)");
}

function load_tile(x, y, color, char, type, target_id) {
    let i = calc_idx(x, y);
    TERRAIN_MAP[i] = (color << 8) | char;
    COLLISION_MAP[i] = type;
    TRANSITION_MAP[i] = target_id;
}

function handle_events() {
    // Channel listeners are injected here
}

${STANDARD_AJS_POSTAMBLE}
`;

export const PLATFORM_AJS_SOURCE = AJS_LOGIC;

export const PLATFORM_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  BLOCK_STANDARD_INBOX,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.PLATFORM),
  ": RUN_PLATFORM_CYCLE PROCESS_INBOX UPDATE_PHYSICS RENDER_LOGIC ;",
  ": SET_LEVEL_ID SET_LEVEL_ID ;",
  ": INIT_PLATFORMER INIT_PLATFORMER_LOGIC AJS_INIT_CHANNELS ' HANDLE_EVENTS HANDLE_EVENTS_XT ! ;",
  ": LOAD_TILE LOAD_TILE ;",
  ": SPAWN_ENTITY SPAWN_ENTITY_LOGIC ;",
  ": CMD_JUMP JUMP_PLAYER ;",
  ": CMD_MOVE ( dir -- ) MOVE_PLAYER ;",
  ": CMD_INTERACT TRIGGER_SKILL ;",
  ": CMD_TELEPORT TELEPORT_PLAYER ;",
  ": PLAYER_X PLAYER_X_VAL ;",
  ": PLAYER_Y PLAYER_Y_VAL ;",
  ": PLAYER_VX PLAYER_VX_VAL ;",
  ": PLAYER_VY PLAYER_VY_VAL ;"
];
