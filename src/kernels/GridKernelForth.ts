
// Aethelgard Grid Physics Kernel v3.92 (PHYSICS SERVER)
import { STANDARD_KERNEL_FIRMWARE } from "./SharedBlocks";

// 1. GRID CONSTANTS
const BLOCK_GRID_CONSTANTS = `
40 CONSTANT MAP_WIDTH
20 CONSTANT MAP_HEIGHT
HEX
30000 CONSTANT COLLISION_MAP
30400 CONSTANT PLAYER_STATE
80000 CONSTANT VRAM_BASE
90000 CONSTANT ENTITY_TABLE
DECIMAL
16 CONSTANT ENT_SIZE
32 CONSTANT MAX_ENTITIES
`;

// 2. UTILS
const BLOCK_UTILS = `
: >= ( n1 n2 -- flag ) < 0= ;
: TWO_OVER ( x1 x2 x3 x4 -- x1 x2 x3 x4 x1 x2 ) 3 PICK 3 PICK ;
`;

// 3. GRAPHICS
const BLOCK_GRAPHICS = `
: CALC_VRAM_ADDR ( x y -- addr ) MAP_WIDTH * + 4 * VRAM_BASE + ;
: DRAW_CELL ( x y color char -- )
  >R >R 2DUP CALC_VRAM_ADDR R> 8 LSHIFT R> OR SWAP ! 2DROP
;
`;

// 4. MAP DATA
const BLOCK_MAP_DATA = `
: CALC_COLLISION_ADDR ( x y -- addr ) MAP_WIDTH * + COLLISION_MAP + ;
: INIT_MAP
  MAP_HEIGHT 0 DO
    MAP_WIDTH 0 DO
      I J 0 32 DRAW_CELL
      I J CALC_COLLISION_ADDR 0 SWAP C!
    LOOP
  LOOP
  0 ENTITY_COUNT !
  S" [GRID] Map Initialized & Entities Reset" S.
;

: LOAD_TILE ( x y color char type -- )
  >R TWO_OVER CALC_COLLISION_ADDR R@ SWAP C! DRAW_CELL R> DROP
;
`;

// 5. PLAYER & ENTITY SYSTEM
const BLOCK_ENTITIES = `
VARIABLE ENTITY_COUNT
0 ENTITY_COUNT !

: GET_ENT_PTR ( id -- ptr ) ENT_SIZE * ENTITY_TABLE + ;

: SPAWN_ENTITY ( x y color char -- )
  ENTITY_COUNT @ MAX_ENTITIES >= IF 2DROP 2DROP EXIT THEN
  
  ENTITY_COUNT @ GET_ENT_PTR >R ( Save ptr to R-stack )
  R@ ! ( char )
  R@ 4 + ! ( color )
  R@ 8 + ! ( y )
  R@ 12 + ! ( x )
  
  R@ 12 + @ R@ 8 + @ R@ 4 + @ R@ @ DRAW_CELL
  
  ( Set Collision Bit for Entity - Mark as Blocked )
  R@ 12 + @ R@ 8 + @ CALC_COLLISION_ADDR 1 SWAP C!
  
  ( Announce Spawn: EVT_MOVED [Physics -> All] ID X Y )
  EVT_MOVED K_PHYSICS K_HIVE ENTITY_COUNT @ R@ 12 + @ R@ 8 + @ BUS_SEND
  
  R> DROP ( Clean ptr )
  1 ENTITY_COUNT +!
;

: CHECK_BOUNDS ( x y -- flag )
  OVER 0 < IF 2DROP 0 EXIT THEN
  OVER MAP_WIDTH >= IF 2DROP 0 EXIT THEN
  DUP 0 < IF 2DROP 0 EXIT THEN
  DUP MAP_HEIGHT >= IF 2DROP 0 EXIT THEN
  2DROP -1
;

( FIXED v3.93: Robust Entity Lookup to prevent Ghost Collisions )
: FIND_ENTITY_AT ( x y -- id )
  -1 ( Default: Not Found )
  ENTITY_COUNT @ 0 ?DO
     I GET_ENT_PTR >R
     
     ( Check X )
     R@ 12 + @ 3 PICK = IF
        ( Check Y )
        R@ 8 + @ 2 PICK = IF
           R> DROP    ( Drop Ptr )
           DROP I     ( Drop -1, Push ID )
           LEAVE      ( Done )
        THEN
     THEN
     
     R> DROP ( Clean Ptr )
  LOOP
  
  ( Stack: x y id )
  NIP NIP ( Clean x y, leave id )
;

: MOVE_ENTITY ( id dx dy -- )
  ( Stack: id dx dy )
  ROT DUP >R -ROT ( dx dy ) ( R: id )
  R@ GET_ENT_PTR >R ( dx dy ) ( R: id ptr )
  
  ( Calc Target TX TY )
  SWAP R@ 12 + @ + ( dy tx )
  SWAP R@ 8 + @ + ( tx ty )
  
  ( 1. Validate Bounds )
  2DUP CHECK_BOUNDS 0= IF 2DROP R> DROP R> DROP EXIT THEN
  
  ( 2. Validate Collision )
  2DUP CALC_COLLISION_ADDR C@ 0 <> IF 
      ( Collision Detected! )
      ( Stack: tx ty )
      2DUP FIND_ENTITY_AT ( tx ty obstacle_id )
      
      ( Clean up X Y, we just need obstacle_id )
      ROT DROP ROT DROP ( obstacle_id )
      
      DUP -1 = IF
         ( Wall Hit )
         DROP ( Drop -1 )
         
         ( Construct EVT_COLLIDE packet manually to ensure stack safety )
         ( Op Sender Target P1 P2 P3 )
         EVT_COLLIDE 
         K_PHYSICS 
         R@ ENTITY_TABLE = IF K_PLAYER ELSE K_HIVE THEN 
         R@ ( Source ID )
         0  ( Target ID 0 for Wall )
         0  ( Type 0 for Wall )
         BUS_SEND
         
         R> DROP R> DROP ( Clean R-stack )
      ELSE
         ( Entity Hit: obstacle_id is on stack )
         
         EVT_COLLIDE 
         K_PHYSICS 
         R@ ENTITY_TABLE = IF K_PLAYER ELSE K_HIVE THEN 
         R@ ( Source ID )
         3 PICK ( Target ID - obstacle_id was pushed down by setup )
         1 ( Type 1 for Entity )
         BUS_SEND
         
         DROP ( Drop obstacle_id )
         R> DROP R> DROP ( Clean R-stack )
      THEN ( Replaced ENDIF with THEN )
      
      EXIT 
  THEN
  
  ( Move is valid. Proceed. )

  ( 3. Clear Old Collision )
  R@ 12 + @ R@ 8 + @ CALC_COLLISION_ADDR 0 SWAP C!
  
  ( 4. Redraw Old Spot with Floor )
  R@ 12 + @ R@ 8 + @ 4473924 46 DRAW_CELL
  
  ( 5. Update Coords in Memory )
  OVER R@ 12 + ! ( tx ty ) ( Stored TX )
  DUP R@ 8 + ! ( tx ty ) ( Stored TY )
  
  ( 6. Set New Collision )
  2DUP CALC_COLLISION_ADDR 1 SWAP C!
  
  ( 7. Redraw New Spot with Entity )
  R@ 12 + @ R@ 8 + @ R@ 4 + @ R@ @ DRAW_CELL
  
  ( 8. Emit Event: EVT_MOVED )
  EVT_MOVED K_PHYSICS K_HIVE 
  R> DROP R> ( id )
  5 PICK 5 PICK ( tx ty )
  BUS_SEND
  2DROP
;

: RUN_ENV_CYCLE
  ( Placeholder for Environmental Ticks - Fire, Water Flow, etc )
  ( e.g. iterate all tiles, if tile is FIRE, damage entity on it )
;
`;

// 6. MESSAGE BUS PROCESSOR
const BLOCK_BUS_PROCESSOR = `
: EXECUTE_CMD
  ( Check if message is for PHYSICS or BROADCAST 0 )
  M_TARGET @ K_PHYSICS = M_TARGET @ 0 = OR IF
      
      M_OP @ REQ_MOVE = IF
         M_P1 @ M_P2 @ M_P3 @ MOVE_ENTITY
         EXIT
      THEN

  THEN
;

: PROCESS_INBOX
  0 OUT_PTR ! ( Reset Output Queue )
  BUS_READ_INPUT ( count )
  0 ( count offset )
  
  BEGIN 2DUP > WHILE
    DUP GET_MSG_ADDR >R
    
    ( Push 6 integers to stack )
    R@ @           ( op )
    R@ 4 + @       ( sender )
    R@ 8 + @       ( target )
    R@ 12 + @      ( p1 )
    R@ 16 + @      ( p2 )
    R@ 20 + @      ( p3 )
    
    R> DROP        ( Clean R stack )
    
    UNPACK_MSG     ( Store in registers )
    EXECUTE_CMD    ( Run Logic )
    
    6 + ( count offset+6 )
  REPEAT
  2DROP ( Clean count offset )
;
`;

export const GRID_KERNEL_BLOCKS = [
  ...STANDARD_KERNEL_FIRMWARE,
  BLOCK_GRID_CONSTANTS,
  BLOCK_UTILS,
  BLOCK_GRAPHICS,
  BLOCK_MAP_DATA,
  BLOCK_ENTITIES,
  BLOCK_BUS_PROCESSOR
];

export const GRID_KERNEL = GRID_KERNEL_BLOCKS.join("\n");
