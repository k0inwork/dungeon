
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
const TRANSITION_MAP = new Int32Array(0x41000); // 256 entries

// Fixed-point 16.16
let player_x = 2 * 65536;
let player_y = 10 * 65536;
let player_vx = 0;
let player_vy = 0;

const gravity = 5000;
const jump_force = -75000;
const move_speed = 20000;
let current_level = 0;

function calc_idx(x, y) { return (y * MAP_WIDTH + x); }

function get_collision(x, y) {
    if (x < 0) return 1;
    if (x >= MAP_WIDTH) return 1;
    if (y < 0) return 0;
    if (y >= MAP_HEIGHT) return 1;
    return COLLISION_MAP[calc_idx(x, y)];
}

function init_platformer() {
    Log("[PLATFORM] INIT: X Addr next...");
    // AJS doesn't have an & operator, but I can use a Forth block
    player_x = 2 * 65536;
    player_y = 2 * 65536;
    player_vx = 0;
    player_vy = 0;
    current_level = 0;

    let i = 0;
    while (i < 800) {
        COLLISION_MAP[i] = 0;
        TERRAIN_MAP[i] = 0;
        i++;
    }

    i = 0;
    while (i < 256) {
        TRANSITION_MAP[i] = 0;
        i++;
    }

    Log("[PLATFORM] Kernel Ready (v6)");
}

function set_transition(charCode, targetIdx) {
    TRANSITION_MAP[charCode] = targetIdx + 1;
}

function set_player_pos(x, y) {
    Log("[PLATFORM] PLAYER_X Addr:");
    Log(player_x); // Wait, this logs the value. I want the address.
    // In AJS I can't get the address easily.
    player_x = x * 65536;
    player_y = y * 65536;
}

function load_tile(x, y, color, char, type) {
    let i = calc_idx(x, y);
    TERRAIN_MAP[i] = (color << 8) | char;
    COLLISION_MAP[i] = type;
}

function update_physics() {
    player_vy = player_vy + gravity;
    player_vx = (player_vx * 8) / 10; // friction

    if (player_vx != 0) {
        Log("[PLATFORM] VX after friction:");
        Log(player_vx);
    }

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
    let py = player_y / 65536;

    if (player_vx > 0) {
        let coll = get_collision(h_rx, py);
        if (coll != 0) {
            Log("[PLATFORM] Collision detected at:");
            Log(h_rx); Log(py);
            player_vx = 0;
            player_x = (h_rx - 1) * 65536;
        } else {
            player_x = nx;
        }
    } else if (player_vx < 0) {
        if (get_collision(h_lx, py)) {
            player_vx = 0;
            player_x = (h_lx + 1) * 65536;
        } else {
            player_x = nx;
        }
    }

    // Bounds clamp
    if (player_x < 0) player_x = 0;
    if (player_y < 0) player_y = 0;

    // Win condition: reach any GATE tile
    let p_cx = player_x / 65536;
    let p_cy = player_y / 65536;
    let p_ti = calc_idx(p_cx, p_cy);
    if (p_ti >= 0) {
        if (p_ti < 800) {
            let p_packed = TERRAIN_MAP[p_ti];
            let p_char = p_packed & 255;
            let p_targetPlusOne = TRANSITION_MAP[p_char];

            if (p_char != 0) {
                Log("[PLATFORM] At Tile Char:");
                Log(p_char);
                Log("Target+1:");
                Log(p_targetPlusOne);
            }

            if (p_targetPlusOne != 0) {
                bus_send(EVT_LEVEL_TRANSITION, K_PLATFORM, K_HOST, p_targetPlusOne - 1, 0, 0);
                Log("[PLATFORM] Transition Sent!");
                player_x = 5 * 65536; // Reset pos to prevent multi-trigger
                Log("[PLATFORM] Player X Reset!");
            }
        }
    }

    if (player_x > 39 * 65536) player_x = 39 * 65536;
    if (player_y > 19 * 65536) player_y = 19 * 65536;
}

function render() {
    // 1. Copy Terrain to VRAM
    let i = 0;
    while (i < 800) { // 40 * 20
        VRAM[i] = TERRAIN_MAP[i];
        i++;
    }

    // 2. Draw Player '@'
    let px = player_x / 65536;
    let py = player_y / 65536;
    let pidx = calc_idx(px, py);
    if (pidx >= 0) {
        if (pidx < 800) {
            VRAM[pidx] = (0x00FF00 << 8) | 64; // Green '@'
        }
    }
}

function move_player(dir) {
    player_vx = player_vx + (dir * move_speed);
}

function jump_player() {
    let bx = player_x / 65536;
    let by = (player_y / 65536) + 1;
    if (get_collision(bx, by) != 0) {
        player_vy = jump_force;
    }
}

function set_level(id) {
    current_level = id;
}

function handle_events() {
    if (M_OP == 101) { move_player(M_P1); }
    if (M_OP == 301) { jump_player(); }
}

${STANDARD_AJS_POSTAMBLE}
`;

export const PLATFORM_AJS_SOURCE = AJS_LOGIC;

export const PLATFORM_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.PLATFORM),
  "S\" [PLATFORM] AJS Loaded\" S.",
  ": RUN_PLATFORM_CYCLE PROCESS_INBOX UPDATE_PHYSICS RENDER ;",
  ": CMD_JUMP JUMP_PLAYER ;",
  ": CMD_MOVE ( dir -- ) MOVE_PLAYER ;",
  ": DEBUG_PLAYER_X PLAYER_X .N ;",
  ": DEBUG_PLAYER_VX PLAYER_VX .N ;",
  ": DEBUG_OUT_PTR OUT_PTR .N ;"
];
