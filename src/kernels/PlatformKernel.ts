
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
const VRAM          = new Uint32Array(0x80000);

// Fixed-point 16.16
let player_x = 2 * 65536;
let player_y = 10 * 65536;
let player_vx = 0;
let player_vy = 0;

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

function init_platformer() {
    player_x = 2 * 65536;
    player_y = 2 * 65536;
    player_vx = 0;
    player_vy = 0;
    Chan().on(on_platform_request);
    Chan("BUS").on(on_platform_request);
    Log("[PLATFORM] Kernel Ready (v4)");
}

function load_tile(x, y, color, char, type) {
    let i = calc_idx(x, y);
    TERRAIN_MAP[i] = (color << 8) | char;
    COLLISION_MAP[i] = type;
}

function update_physics() {
    player_vy = player_vy + gravity;
    player_vx = (player_vx * 8) / 10; // friction

    let nx = player_x + player_vx;
    let ny = player_y + player_vy;

    // Player bounding box with small insets to prevent corner-snagging
    let lx = (player_x + 4000) / 65536;
    let rx = (player_x + 61536) / 65536;

    // 1. Vertical Collision (check both left and right edges)
    let by_foot = (ny + 65535) / 65536;
    let by_head = ny / 65536;
    let by_mid_travel = (player_y + (player_vy / 2) + 65535) / 65536;

    if (player_vy > 0) {
        // Check foot AND mid-point of travel to prevent tunneling
        if (get_collision(lx, by_foot) || get_collision(rx, by_foot) || get_collision(lx, by_mid_travel) || get_collision(rx, by_mid_travel)) {
            // If we hit mid_travel but not by_foot, we should snap to the mid_travel platform
            if (get_collision(lx, by_mid_travel) || get_collision(rx, by_mid_travel)) {
                if (get_collision(lx, by_foot) == 0 && get_collision(rx, by_foot) == 0) {
                    by_foot = by_mid_travel;
                }
            }
            player_vy = 0;
            player_y = (by_foot - 1) * 65536;
            ny = player_y;
        } else {
            player_y = ny;
        }
    } else if (player_vy < 0) {
        if (get_collision(lx, by_head) || get_collision(rx, by_head) || get_collision(lx, by_mid_travel) || get_collision(rx, by_mid_travel)) {
            player_vy = 0;
            player_y = (by_head + 1) * 65536;
            ny = player_y;
        } else {
            player_y = ny;
        }
    } else {
        player_y = ny;
    }

    // 2. Horizontal Collision (using updated Y)
    let h_rx = (nx + 63536) / 65536;
    let h_lx = (nx + 2000) / 65536;
    let pyy = player_y / 65536;

    if (player_vx > 0) {
        if (get_collision(h_rx, pyy)) {
            player_vx = 0;
            player_x = (h_rx - 1) * 65536;
        } else {
            player_x = nx;
        }
    } else if (player_vx < 0) {
        if (get_collision(h_lx, pyy)) {
            player_vx = 0;
            player_x = (h_lx + 1) * 65536;
        } else {
            player_x = nx;
        }
    }

    // Bounds clamp
    if (player_x < 0) player_x = 0;
    if (player_y < 0) player_y = 0;

    // Check for Exit
    let exit_px = (player_x + 32768) / 65536;
    let exit_py = (player_y + 32768) / 65536;
    let exit_idx = calc_idx(exit_px, exit_py);
    let exit_packed = TERRAIN_MAP[exit_idx];
    let exit_char = exit_packed & 255;

    if (exit_char == 62 || exit_char == 88) { // '>' or 'X'
        let exit_target = -1;
        if (CURRENT_LEVEL_ID == 1) { exit_target = 2; } // P1 -> Roguelike (Index 2)
        if (CURRENT_LEVEL_ID == 3) { exit_target = 5; } // P2 -> Main Dungeon (Index 5)
        if (CURRENT_LEVEL_ID == 4) { exit_target = 0; } // P3 -> Hub (Index 0)

        if (exit_target != -1) {
            bus_send(EVT_LEVEL_TRANSITION, K_PLATFORM, K_HOST, exit_target, 0, 0);
            player_x = 5 * 65536; // Reset pos
        }
    }

    if (player_x > 39 * 65536) player_x = 39 * 65536;
    if (player_y > 19 * 65536) player_y = 19 * 65536;
}

function render() {
    // 1. Copy Terrain to VRAM
    let ri = 0;
    while (ri < 800) { // 40 * 20
        VRAM[ri] = TERRAIN_MAP[ri];
        ri++;
    }

    // 2. Draw Player '@'
    let ren_px = player_x / 65536;
    let ren_py = player_y / 65536;
    let ren_pidx = calc_idx(ren_px, ren_py);
    if (ren_pidx >= 0) {
        if (ren_pidx < 800) {
            VRAM[ren_pidx] = (0x00FF00 << 8) | 64; // Green '@'
        }
    }
}

function move_player(m_dir) {
    player_vx = player_vx + (m_dir * move_speed);
}

function jump_player() {
    let bx = player_x / 65536;
    let by = (player_y / 65536) + 1;
    if (get_collision(bx, by) != 0) {
        player_vy = jump_force;
    }
}

function on_platform_request(op, sender, p1, p2, p3) {
    if (op == REQ_MOVE) { move_player(p1); }
    if (op == CMD_INTERACT) { jump_player(); }
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
  ": RUN_PLATFORM_CYCLE PROCESS_INBOX UPDATE_PHYSICS RENDER ;",
  ": SET_LEVEL_ID SET_LEVEL_ID ;",
  ": INIT_PLATFORMER INIT_PLATFORMER ;",
  ": CMD_JUMP JUMP_PLAYER ;",
  ": CMD_MOVE ( dir -- ) MOVE_PLAYER ;"
];
