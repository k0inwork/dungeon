
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

let gravity = 3000;
let jump_force = -60000;
let move_speed = 5000;
let friction = 52428; // 0.8 * 65536

function calc_idx(x, y) { return (y * MAP_WIDTH + x); }

function get_collision(x, y) {
    if (x < 0) return 1;
    if (x >= MAP_WIDTH) return 1;
    if (y < 0) return 0;
    if (y >= MAP_HEIGHT) return 1;
    return COLLISION_MAP[calc_idx(x, y)];
}

function init_platformer() {
    player_x = 2 * 65536;
    player_y = 10 * 65536;
    player_vx = 0;
    player_vy = 0;
    Log("[PLATFORM] Kernel Ready");
}

function load_tile(x, y, color, char, type) {
    let i = calc_idx(x, y);
    TERRAIN_MAP[i] = (color << 8) | char;
    COLLISION_MAP[i] = type;
}

function update_physics() {
    player_vy = player_vy + gravity;
    player_vx = (player_vx * 4) / 5;

    let nx = player_x + player_vx;
    let ny = player_y + player_vy;

    // Feet check (bottom of the character)
    let bx = nx / 65536;
    let by = (ny + 32768) / 65536;

    if (get_collision(bx, by) != 0) {
        if (player_vy > 0) {
            player_vy = 0;
            player_y = (by - 1) * 65536;
        } else {
            player_vy = 0;
            player_vx = 0;
        }
    } else {
        player_x = nx;
        player_y = ny;
    }

    // Bounds clamp
    if (player_x < 0) player_x = 0;
    if (player_y < 0) player_y = 0;

    // Win condition: reach right side
    if (player_x > 38 * 65536) {
        bus_send(EVT_LEVEL_TRANSITION, K_PLATFORM, K_HOST, 0, 0, 0); // Back to Hub
        // Reset pos to prevent multiple triggers
        player_x = 37 * 65536;
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

    // 2. Draw Player 'G'
    let px = player_x / 65536;
    let py = player_y / 65536;
    let pidx = calc_idx(px, py);
    if (pidx >= 0) {
        if (pidx < 800) {
            VRAM[pidx] = (0xFF00FF << 8) | 71; // Magenta 'G'
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

function handle_events() {
    if (M_OP == 101) { move_player(M_P1); }
    if (M_OP == 301) { jump_player(); }
}

${STANDARD_AJS_POSTAMBLE}
`;

export const PLATFORM_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  AetherTranspiler.transpile(AJS_LOGIC, KernelID.PLATFORM),
  ": RUN_PLATFORM_CYCLE PROCESS_INBOX UPDATE_PHYSICS RENDER ;",
  ": INIT_PLATFORMER INIT_PLATFORMER ;",
  ": CMD_JUMP JUMP_PLAYER ;",
  ": CMD_MOVE ( dir -- ) MOVE_PLAYER ;"
];
