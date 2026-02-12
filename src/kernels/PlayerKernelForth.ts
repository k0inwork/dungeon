
// Aethelgard Player Kernel v1.6
import { STANDARD_KERNEL_FIRMWARE } from "./SharedBlocks";

// PLAYER STATE
const BLOCK_PLAYER_STATE = `
VARIABLE PLAYER_HP
100 PLAYER_HP !
VARIABLE PLAYER_GOLD
0 PLAYER_GOLD !
`;

// MESSAGE PROCESSING
const BLOCK_PLAYER_LOGIC = `
: HANDLE_EVENTS
  M_OP @ EVT_COLLIDE = IF
     M_P3 @ 0 = IF
        S" [PLAYER] Blocked by Wall." S.
     ELSE
        ( Player Hit an Entity )
        S" [PLAYER] BUMP! Attacking Entity " S. M_P2 @ .N
        
        ( Send Damage Cmd: Target=M_P2, Amount=10, Type=0 )
        CMD_DAMAGE K_PLAYER K_HIVE M_P2 @ 10 0 BUS_SEND
     THEN
  THEN
; 
`;

const BLOCK_INBOX_LOOP = `
: PROCESS_INBOX
  0 OUT_PTR !
  BUS_READ_INPUT
  0
  BEGIN 2DUP > WHILE
    DUP GET_MSG_ADDR >R
    
    R@ @     ( op )
    R@ 4 + @ ( sender )
    R@ 8 + @ ( target )
    R@ 12 + @ ( p1 )
    R@ 16 + @ ( p2 )
    R@ 20 + @ ( p3 )
    R> DROP

    UNPACK_MSG
    HANDLE_EVENTS
    
    6 +
  REPEAT
  2DROP
;
`;

export const PLAYER_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  BLOCK_PLAYER_STATE,
  BLOCK_PLAYER_LOGIC,
  BLOCK_INBOX_LOOP
];
