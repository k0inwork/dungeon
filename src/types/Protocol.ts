
// AETHELGARD PROTOCOL DEFINITIONS

export enum KernelID {
    HOST = 0,
    PHYSICS = 1,
    PLAYER = 2,
    HIVE = 3,
    BATTLE = 4,
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
