
// Aethelgard Hive AI Kernel v1.9 (THE BRAIN)
import { STANDARD_KERNEL_FIRMWARE } from "./SharedBlocks";

const BLOCK_HIVE_GLOBALS = `
( --- HIVE MEMORY --- )
HEX
90000 CONSTANT HIVE_ENT_TABLE
DECIMAL
16 CONSTANT ENT_SIZE
32 CONSTANT MAX_ENTITIES
VARIABLE HIVE_ENT_COUNT
0 HIVE_ENT_COUNT !

: INIT_HIVE
  0 HIVE_ENT_COUNT !
  S" [HIVE] Memory Reset" S.
;
`;

const BLOCK_RNG = `
VARIABLE RNG_SEED
12345 RNG_SEED !
: RANDOM ( -- n )
  RNG_SEED @ 1103515245 * 12345 + DUP RNG_SEED ! 16 RSHIFT 32767 AND
;
: RAND_DIR ( -- dx dy )
  RANDOM 4 MOD
  DUP 0 = IF DROP 0 -1 EXIT THEN
  DUP 1 = IF DROP 0 1 EXIT THEN
  DUP 2 = IF DROP -1 0 EXIT THEN
  DROP 1 0
;
`;

const BLOCK_AI_LOGIC = `
: UPDATE_HIVE_ENTITY ( id x y -- )
  ROT DUP >R ( x y ) ( R: id )
  ENT_SIZE * HIVE_ENT_TABLE + >R ( x y ) ( R: id ptr )
  
  R@ 4 + ! ( y )
  R@ !     ( x )
  
  ( Update Count: Count = MAX Count, ID + 1 )
  R> DROP ( Clean ptr )
  R> 1 + HIVE_ENT_COUNT @ MAX HIVE_ENT_COUNT !
;

: DECIDE_ACTION ( id -- )
  ( Simple Random Walk Logic )
  
  ( Target Stack for BUS_SEND: op sender target p1 p2 p3 )
  ( We want: REQ_MOVE K_HIVE K_PHYSICS id dx dy )
  
  ( 1. Setup Header )
  REQ_MOVE K_HIVE K_PHYSICS ( id 101 3 1 )
  
  ( 2. Move ID to P1 position )
  3 ROLL ( 101 3 1 id )
  
  ( 3. Generate P2/P3 dx dy )
  RAND_DIR ( 101 3 1 id dx dy )
  
  BUS_SEND
;

: RUN_HIVE_CYCLE
  0 OUT_PTR ! ( Reset Output )
  
  ( 1. Process Inbox - Listen to Grid )
  BUS_READ_INPUT ( count )
  0 ( count offset )
  
  BEGIN 2DUP > WHILE
    DUP GET_MSG_ADDR >R
    
    ( Push 6 integers )
    R@ @           ( op )
    R@ 4 + @       ( sender )
    R@ 8 + @       ( target )
    R@ 12 + @      ( p1 )
    R@ 16 + @      ( p2 )
    R@ 20 + @      ( p3 )
    
    R> DROP        ( Clean R stack )
    UNPACK_MSG     ( Store in registers )
    
    ( Event Handling: MOVED )
    M_OP @ EVT_MOVED = IF
       ( M_P1=ID, M_P2=X, M_P3=Y )
       M_P1 @ M_P2 @ M_P3 @ UPDATE_HIVE_ENTITY
    THEN
    
    ( Event Handling: COLLIDE )
    M_OP @ EVT_COLLIDE = IF
       ( Logic: If I bumped into Player, Attack! )
       ( M_P1 = SourceID, M_P2 = TargetID, M_P3 = Type )
       
       M_P3 @ 1 = IF 
          ( Hit Entity )
          M_P2 @ 0 = IF 
              ( Hit Player )
              S" [HIVE] Entity " S. M_P1 @ .N S"  attacks Player!" S.
              
              ( Send Damage Cmd: Target=Player, Amount=5, Type=1 )
              CMD_DAMAGE K_HIVE K_PLAYER M_P2 @ 5 1 BUS_SEND
          THEN
       THEN
    THEN

    6 + ( count offset+6 )
  REPEAT
  2DROP ( Clean count offset )
  
  ( 2. Think - Send Commands to Grid )
  ( Loop from ID 1 to Count. Skip ID 0 Player )
  HIVE_ENT_COUNT @ 1 ?DO
    I DECIDE_ACTION
  LOOP
;
`;

export const HIVE_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  BLOCK_HIVE_GLOBALS,
  BLOCK_RNG,
  BLOCK_AI_LOGIC
];
