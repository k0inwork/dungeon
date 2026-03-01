
import { KernelID, Opcode, VSO_REGISTRY } from "../types/Protocol";

export function generateAjsProtocolBlock(): string {
    let ajs = `// --- AUTO-GENERATED PROTOCOL CONSTANTS ---\n`;

    ajs += `// --- KERNEL IDS ---\n`;
    for (const [name, value] of Object.entries(KernelID)) {
        if (isNaN(Number(name))) {
            ajs += `const K_${name} = ${value};\n`;
        }
    }

    ajs += `\n// --- PROTOCOL OPCODES ---\n`;
    for (const [name, value] of Object.entries(Opcode)) {
        if (isNaN(Number(name))) {
            ajs += `const ${name} = ${value};\n`;
        }
    }

    ajs += `\n// --- VSO TYPE IDS ---\n`;
    for (const [name, def] of Object.entries(VSO_REGISTRY)) {
        ajs += `const VSO_${name.toUpperCase()} = ${def.typeId};\n`;
    }

    return ajs;
}

export const BLOCK_AJS_MEMORY_MAP = `
const INPUT_QUEUE = 0x400;
const OUTPUT_QUEUE = 0x10400;
const STR_BUF_START = 0x70000;
const STR_BUF_END = 0x7FFFF;
const TEMP_VSO_BUFFER = 0xD0000;
`;

export const BLOCK_AJS_MSG_REGISTERS = `
let M_OP = 0;
let M_SENDER = 0;
let M_TARGET = 0;
let M_P1 = 0;
let M_P2 = 0;
let M_P3 = 0;
`;

export const BLOCK_AJS_OVERSEER_PROPOSALS = `
// --- OVERSEER PROPOSAL CONSTANTS ---
// Action Types
const ACT_GRANT_SKILL = 1;
const ACT_BLOCK_SKILL = 2;
const ACT_OVERRIDE_BEHAVIOR = 3;

// Overseer Types
const OS_RACE = 1;
const OS_CLASS = 2;
const OS_ORIGIN = 3;
const OS_QUEST = 4;
const OS_TERRAIN = 5;

// Struct Size (in 32-bit words)
const PROPOSAL_STRUCT_SIZE = 4;

// --- PROPOSAL RESOLUTION LOGIC ---
// AJS does not support standard objects, so we process an array of flat structs
// [0]: Overseer Type (e.g. OS_QUEST)
// [1]: Action Type (e.g. ACT_GRANT_SKILL)
// [2]: Target ID (e.g. FIREBALL_SKILL_ID)
// [3]: Weight/Priority (e.g. 100)
function resolve_proposals(proposal_array_ptr, proposal_count, output_array_ptr) {
    // 1. First pass: Find all blocks/vetoes (highest priority)
    let block_count = 0;
    // ... logic to aggregate blocks ...

    // 2. Second pass: Gather grants and overrides, filtering out blocks
    // ... logic to weigh and filter ...

    // 3. Output final active actions/skills to output_array_ptr
}
`;

export const BLOCK_AJS_BUS_UTILS = `
let OUT_PTR = 0;
const INBOX = new Uint32Array(0x404); // INPUT_QUEUE + 4
const OUTBOX = new Uint32Array(0x10404); // OUTPUT_QUEUE + 4
const IN_COUNT = new Uint32Array(0x400);
const OUT_COUNT = new Uint32Array(0x10400);

function bus_send(op, sender, target, p1, p2, p3) {
    Log("[BUS] Sending packet...");
    OUTBOX[OUT_PTR] = op;
    OUTBOX[OUT_PTR + 1] = sender;
    OUTBOX[OUT_PTR + 2] = target;
    OUTBOX[OUT_PTR + 3] = p1;
    OUTBOX[OUT_PTR + 4] = p2;
    OUTBOX[OUT_PTR + 5] = p3;

    OUT_PTR += 6;
    OUT_COUNT[0] = OUT_PTR;
}

function bus_read_input() {
    return IN_COUNT[0];
}
`;

export const BLOCK_AJS_STANDARD_INBOX = `
function process_inbox() {
    OUT_PTR = 0;
    let totalCount = bus_read_input();
    let offset = 0;

    while (offset < totalCount) {
        let op = INBOX[offset];

        if (op == SYS_BLOB) {
            M_OP = INBOX[offset + 4];
            M_SENDER = INBOX[offset + 1];
            M_TARGET = INBOX[offset + 2];
            M_P1 = INBOX[offset + 3];
            M_P2 = INPUT_QUEUE + 4 + (offset + 6) * 4;
            handle_events();
            offset += (M_P1 + 6);
        } else {
            M_OP = op;
            M_SENDER = INBOX[offset + 1];
            M_TARGET = INBOX[offset + 2];
            M_P1 = INBOX[offset + 3];
            M_P2 = INBOX[offset + 4];
            M_P3 = INBOX[offset + 5];
            handle_events();
            offset += 6;
        }
    }
    IN_COUNT[0] = 0;
}
`;

// Preamble: Constants and Variables
export const STANDARD_AJS_PREAMBLE = [
    generateAjsProtocolBlock(),
    BLOCK_AJS_MEMORY_MAP,
    BLOCK_AJS_MSG_REGISTERS,
    BLOCK_AJS_BUS_UTILS,
    BLOCK_AJS_OVERSEER_PROPOSALS
].join("\n");

// Postamble: The Inbox Processor (must be included AFTER handle_events is defined)
export const STANDARD_AJS_POSTAMBLE = [
    BLOCK_AJS_STANDARD_INBOX
].join("\n");
