
// AETHELGARD PROTOCOL DEFINITIONS

export enum KernelID {
    HOST = 0,
    GRID = 1,
    PLAYER = 2,
    HIVE = 3,
    BATTLE = 4,
    PLATFORM = 5,

    // Dynamic/Test Kernels (10-20)
    TEST1 = 10,
    TEST2 = 11,
    TEST3 = 12,

    BUS = 255
}

export enum Opcode {
    // --- PHYSICS (100-199) ---
    REQ_MOVE = 101,     // [ID, dX, dY]
    REQ_TELEPORT = 102, // [ID, X, Y]
    REQ_TERRAIN = 103,  // [X, Y, TileID]
    REQ_PATH_STEP = 105,// [ID, TargetX, TargetY]

    // --- EVENTS (200-299) ---
    EVT_MOVED = 201,    // [ID, X, Y]
    EVT_COLLIDE = 202,  // [SourceID, TargetID, Type]
    EVT_SPAWN = 203,    // [ID, Type, XY_Packed]
    EVT_DAMAGE = 204,   // [TargetID, Amount, Type]
    EVT_DEATH = 205,    // [TargetID, 0, 0]
    EVT_ITEM_GET = 206, // [PlayerID, ItemID, 0]
    EVT_LEVEL_TRANSITION = 207, // [TargetLevelID, X, Y]

    // --- INTERACTION (300-399) ---
    CMD_INTERACT = 301, // [SourceID, TargetID, Verb]
    CMD_SPEAK = 302,    // [SpeakerID, StringPtr, Tone]
    CMD_ATTACK = 303,   // [AttackerID, TargetID, Type]
    CMD_KILL = 304,     // [TargetID, 0, 0] (Admin kill)
    CMD_PICKUP = 305,   // [PlayerID, X, Y]
    
    // --- SYSTEM (900+) ---
    SYS_LOG = 901,
    SYS_ERROR = 999,
    SYS_BLOB = 1000     // [SYS_BLOB, Sender, Target, Len, RealOp, 0] + [Data...]
}

export interface MessagePacket {
    op: number;
    sender: number;
    target: number;
    p1: number;
    p2: number;
    p3: number;
}

export const PACKET_SIZE_INTS = 6;
export const PACKET_SIZE_BYTES = 24;

// --- VIRTUAL SHARED OBJECTS (VSO) REGISTRY ---
export interface VsoStructDef {
    typeId: number;
    owner: KernelID;
    baseAddr: number;
    sizeBytes: number;
    fields: string[];
}

export const VSO_REGISTRY: Record<string, VsoStructDef> = {
    "GridEntity": {
        typeId: 1,
        owner: KernelID.GRID,
        baseAddr: 0x90000,
        sizeBytes: 24,
        fields: ["char", "color", "y", "x", "type", "itemId"]
    },
    "HiveEntity": {
        typeId: 2,
        owner: KernelID.HIVE,
        baseAddr: 0x90000,
        sizeBytes: 12,
        fields: ["x", "y", "type"]
    },
    "RpgEntity": {
        typeId: 3,
        owner: KernelID.BATTLE,
        baseAddr: 0xA0000,
        sizeBytes: 36,
        fields: ["hp", "maxHp", "atk", "def", "level", "exp", "state", "targetId", "invItem"]
    },
    "NPC": {
        typeId: 3,
        owner: KernelID.BATTLE,
        baseAddr: 0xA0000,
        sizeBytes: 36,
        fields: ["hp", "maxHp", "atk", "def", "level", "exp", "state", "targetId", "invItem"]
    },
    "PlayerState": {
        typeId: 4,
        owner: KernelID.PLAYER,
        baseAddr: 0xC0000,
        sizeBytes: 64,
        fields: ["hp", "maxHp", "gold", "invCount", "x", "y", "inv0", "inv1", "inv2", "inv3", "inv4", "inv5", "inv6", "inv7", "inv8", "inv9"]
    }
};

export function generateForthProtocolBlock(): string {
    let forth = `( --- AUTO-GENERATED PROTOCOL CONSTANTS --- )\n`;

    forth += `( --- KERNEL IDS --- )\n`;
    for (const [name, value] of Object.entries(KernelID)) {
        if (isNaN(Number(name))) {
            forth += `${value} CONSTANT K_${name}\n`;
        }
    }

    forth += `\n( --- PROTOCOL OPCODES --- )\n`;
    for (const [name, value] of Object.entries(Opcode)) {
        if (isNaN(Number(name))) {
            forth += `${value} CONSTANT ${name}\n`;
        }
    }

    forth += `\n( --- VSO TYPE IDS --- )\n`;
    for (const [name, def] of Object.entries(VSO_REGISTRY)) {
        forth += `${def.typeId} CONSTANT VSO_${name.toUpperCase()}\n`;
    }

    return forth;
}
