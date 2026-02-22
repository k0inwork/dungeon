
import { STANDARD_KERNEL_FIRMWARE } from "./SharedBlocks";
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

struct GridEntity {
    char,
    color,
    y,
    x,
    type
}

struct EntityPhysics {
    vx,
    vy,
    fx,
    fy,
    active
}

let entities = new Array(GridEntity, MAX_ENTITIES, 0x90000);
let physics  = new Array(EntityPhysics, MAX_ENTITIES, 0x95000);

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
        let ent = entities[i];
        ent.char = 0;
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

function update_entity_physics(id) {
    let p = physics[id];
    if (p.active == 0) return;

    let ent = entities[id];

    // Apply Gravity
    p.vy = p.vy + gravity;
    if (id == 0) {
        p.vx = (p.vx * 8) / 10; // friction for player
    } else {
        p.vx = (p.vx * 9) / 10; // friction for others
    }

    let nx = p.fx + p.vx;
    let ny = p.fy + p.vy;

    let lx = (p.fx + 4000) / 65536;
    let rx = (p.fx + 61536) / 65536;

    // 1. Vertical Collision
    let by_foot = (ny + 65535) / 65536;
    let by_head = ny / 65536;

    if (p.vy > 0) {
        if (get_collision(lx, by_foot) || get_collision(rx, by_foot)) {
            p.vy = 0;
            p.fy = (by_foot - 1) * 65536;
            ny = p.fy;
        } else {
            p.fy = ny;
        }
    } else if (p.vy < 0) {
        if (get_collision(lx, by_head) || get_collision(rx, by_head)) {
            p.vy = 0;
            p.fy = (by_head + 1) * 65536;
            ny = p.fy;
        } else {
            p.fy = ny;
        }
    } else {
        p.fy = ny;
    }

    // 2. Horizontal Collision (using updated FY)
    let h_rx = (nx + 63536) / 65536;
    let h_lx = (nx + 2000) / 65536;
    let pyy = p.fy / 65536;

    if (p.vx > 0) {
        if (get_collision(h_rx, pyy)) {
            p.vx = 0;
            p.fx = (h_rx - 1) * 65536;
        } else {
            p.fx = nx;
        }
    } else if (p.vx < 0) {
        if (get_collision(h_lx, pyy)) {
            p.vx = 0;
            p.fx = (h_lx + 1) * 65536;
        } else {
            p.fx = nx;
        }
    }

    // Bounds clamp
    if (p.fx < 0) p.fx = 0;
    if (p.fy < 0) p.fy = 0;
    if (p.fx > 39 * 65536) p.fx = 39 * 65536;
    if (p.fy > 19 * 65536) p.fy = 19 * 65536;

    // Sync GridEntity for render/host
    ent.x = p.fx / 65536;
    ent.y = p.fy / 65536;

    // Player specific (Exit check)
    if (id == 0) {
        let exit_idx = calc_idx(ent.x, ent.y);
        let exit_target = TRANSITION_MAP[exit_idx];
        if (exit_target != -1) {
            bus_send(EVT_LEVEL_TRANSITION, K_PLATFORM, K_HOST, exit_target, 0, 0);
            p.fx = 5 * 65536; // reset pos
        }
    }
}

function frog_ai(id) {
    let p = physics[id];
    let ent = entities[id];
    let player = physics[0];

    let r = Random() % 100;

    if (ent.type == 1) { // passive frog 'f'
        if (r < 2) {
            if (get_collision(ent.x, ent.y + 1)) {
                p.vy = jump_force / 2;
                p.vx = (Random() % 20000) - 10000;
            }
        }
    } else if (ent.type == 2) { // aggressive frog 'F'
        let dx = p.fx - player.fx;
        let dy = p.fy - player.fy;
        let dist = abs(dx/65536) + abs(dy/65536);

        if (dist < 10) {
            if (r < 5) {
                if (get_collision(ent.x, ent.y + 1)) {
                    p.vy = jump_force / 2;
                    if (dx > 0) p.vx = -15000; else p.vx = 15000;
                }
            }
            if (dist < 1) {
                bus_send(EVT_DAMAGE, K_PLATFORM, K_BUS, 0, 1, 0);
            }
        }
    }
}

function check_player_stomps() {
    let player = physics[0];
    if (player.vy <= 0) return;

    let i = 1;
    while (i < ENTITY_COUNT) {
        let p = physics[i];
        if (p.active) {
            let ent = entities[i];
            if (ent.type == 1 || ent.type == 2) {
                let dx = abs(player.fx - p.fx);
                let dy = player.fy - p.fy;
                if (dx < 40000 && dy > -32768 && dy < 32768) {
                    bus_send(EVT_DAMAGE, K_PLATFORM, K_BUS, i, 10, 0);
                    player.vy = jump_force / 2;
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
        let p = physics[i];
        if (p.active) {
            update_entity_physics(i);
            let ent = entities[i];
            if (ent.type == 1 || ent.type == 2) {
                frog_ai(i);
            }
        }
        i++;
    }

    if (skill_timer > 0) skill_timer--;
}

function spawn_entity_logic(x, y, color, char, type) {
    if (ENTITY_COUNT >= MAX_ENTITIES) return;
    let id = ENTITY_COUNT;
    ENTITY_COUNT++;

    let ent = entities[id];
    ent.char = char;
    ent.color = color;
    ent.x = x;
    ent.y = y;
    ent.type = type;

    let p = physics[id];
    p.fx = x * 65536;
    p.fy = y * 65536;
    p.vx = 0;
    p.vy = 0;
    p.active = 1;

    Chan("npc_sync") <- [EVT_SPAWN, id, type, 0];
    Chan("npc_sync") <- [EVT_MOVED, id, x, y];
}

function trigger_skill() {
    skill_timer = 10;
    let player = physics[0];
    let px = player.fx / 65536;
    let py = player.fy / 65536;

    let i = 1;
    while (i < ENTITY_COUNT) {
        let p = physics[i];
        if (p.active) {
            let ent = entities[i];
            if (ent.type == 1 || ent.type == 2) {
                let ex = p.fx / 65536;
                let ey = p.fy / 65536;
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
        let player = physics[0];
        let px = player.fx / 65536;
        let py = player.fy / 65536;
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
        let p = physics[i];
        if (p.active) {
            let ent = entities[i];
            let ren_pidx = calc_idx(ent.x, ent.y);
            if (ren_pidx >= 0 && ren_pidx < total) {
                VRAM[ren_pidx] = (ent.color << 8) | ent.char;
            }
        }
        i++;
    }
}

function move_player(m_dir) {
    let p = physics[0];
    p.vx = p.vx + (m_dir * move_speed);
}

function jump_player() {
    let p = physics[0];
    let bx = p.fx / 65536;
    let by = (p.fy / 65536) + 1;
    if (get_collision(bx, by) != 0) {
        p.vy = jump_force;
    }
}

function teleport_player(tx, ty) {
    let p = physics[0];
    p.fx = tx * 65536;
    p.fy = ty * 65536;
    p.vx = 0;
    p.vy = 0;
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
    if (op == EVT_DAMAGE) {
        if (p1 > 0) {
            let ent = entities[p1];
            if (ent.type == 3) return;
            let p = physics[p1];
            p.active = 0;
            ent.char = 32;
            Chan("npc_sync") <- [EVT_DEATH, p1, 0, 0];
        }
    }
}

function handle_events() {
    // Channel listeners are injected here
}

${STANDARD_AJS_POSTAMBLE}
`;

export const PLATFORM_AJS_SOURCE = AJS_LOGIC;

export const PLATFORM_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.PLATFORM),
  ": RUN_PLATFORM_CYCLE PROCESS_INBOX UPDATE_PHYSICS RENDER_LOGIC ;",
  ": SET_LEVEL_ID SET_LEVEL_ID ;",
  ": INIT_PLATFORMER INIT_PLATFORMER_LOGIC AJS_INIT_CHANNELS ;",
  ": LOAD_TILE LOAD_TILE ;",
  ": SPAWN_ENTITY SPAWN_ENTITY_LOGIC ;",
  ": CMD_JUMP JUMP_PLAYER ;",
  ": CMD_MOVE ( dir -- ) MOVE_PLAYER ;",
  ": CMD_INTERACT trigger_skill ;",
  ": CMD_TELEPORT TELEPORT_PLAYER ;",
  ": PLAYER_X player_x_val ;",
  ": PLAYER_Y player_y_val ;",
  ": PLAYER_VX player_vx_val ;",
  ": PLAYER_VY player_vy_val ;"
];
