
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

export const BLOCK_AJS_BUS_UTILS = `
let OUT_PTR = 0;
const INBOX = new Uint32Array(0x404); // INPUT_QUEUE + 4
const OUTBOX = new Uint32Array(0x10404); // OUTPUT_QUEUE + 4
const IN_COUNT = new Uint32Array(0x400);
const OUT_COUNT = new Uint32Array(0x10400);

function bus_send(op, sender, target, p1, p2, p3) {
    // Log("[AJS] bus_send op=" + op + " OUT_PTR=" + OUT_PTR);
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
}
`;

// Preamble: Constants and Variables
export const STANDARD_AJS_PREAMBLE = [
    generateAjsProtocolBlock(),
    BLOCK_AJS_MEMORY_MAP,
    BLOCK_AJS_MSG_REGISTERS,
    BLOCK_AJS_BUS_UTILS
].join("\n");

// Postamble: The Inbox Processor (must be included AFTER handle_events is defined)
export const STANDARD_AJS_POSTAMBLE = [
    BLOCK_AJS_STANDARD_INBOX
].join("\n");
