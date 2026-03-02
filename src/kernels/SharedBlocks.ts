
// SHARED KERNEL BLOCKS v1.24
// Includes Protocol Constants, Message Registers, and Core IO
import { generateForthProtocolBlock } from "../types/Protocol";

export const BLOCK_HOST_BINDINGS = `
( --- HOST BINDINGS --- )
( Native WAForth Bindings )
( Usage: S" NAME" SCALL calls the bound JS function )

: JS_LOG   ( addr len -- ) S" JS_LOG" SCALL ;
: JS_EVENT ( code -- )     S" JS_EVENT" SCALL ;
: JS_ERR   ( code -- )     S" JS_ERR" SCALL ;
: JS_REGISTER_VSO ( addr typeId sizeBytes -- ) S" JS_REGISTER_VSO" SCALL ;
: JS_SYNC_OBJECT ( id typeId -- ptr ) S" JS_SYNC_OBJECT" SCALL ;
: JS_ASSERT ( actual expected -- ) S" JS_ASSERT" SCALL ;
: JS_TRACE ( line -- )     S" JS_TRACE" SCALL ;
: JS_ASSERT_STACK ( depth -- ) S" JS_ASSERT_STACK" SCALL ;

1004 CONSTANT DEBUG_MODE_PTR
`;

export const BLOCK_CORE_POLYFILLS = `
( --- CORE POLYFILLS --- )
( Essential words that might be missing in minimal Forth kernels )

: NOOP ;
: PLAYER_BOOT ;
: AJS_INIT_CHANNELS ;
: MATH_FLOOR ;

( 1. 2DROP - Drop two items )
: 2DROP ( n1 n2 -- ) DROP DROP ;

( 2. NIP - Drop item below top )
: NIP ( n1 n2 -- n2 ) SWAP DROP ;

( 3. CELLS - Convert to byte offset )
: CELLS ( n -- n*4 ) 4 * ;

( 4. -ROT - Rotate stack backwards: n1 n2 n3 -- n3 n1 n2 )
: -ROT ( n1 n2 n3 -- n3 n1 n2 ) ROT ROT ;

( 4. CMOVE - Copy characters from src to dest )
( src dest u -- )
: CMOVE 
  DUP 0= IF DROP 2DROP EXIT THEN ( Handle 0 length )
  0 DO
    OVER C@ OVER C!
    1+ SWAP 1+ SWAP
  LOOP
  2DROP
;

( 5. MATH HELPERS )
: MAX ( n1 n2 -- max ) 2DUP < IF SWAP THEN DROP ;
: MIN ( n1 n2 -- min ) 2DUP > IF SWAP THEN DROP ;
: NEGATE ( n -- -n ) 0 SWAP - ;
: ABS ( n -- |n| ) DUP 0 < IF NEGATE THEN ;

( 6. COMPARISONS )
: <= ( n1 n2 -- f ) > 0= ;
: >= ( n1 n2 -- f ) < 0= ;
: <> ( n1 n2 -- f ) = 0= ;
`;

export const BLOCK_MATH = `
( --- BITWISE MATH --- )
( Ensure standard bitwise words exist. WAForth usually has them, but explicit defs help portability )
: LSHIFT ( x u -- x' ) LSHIFT ; 
: RSHIFT ( x u -- x' ) RSHIFT ;
: OR ( x1 x2 -- x3 ) OR ;
: AND ( x1 x2 -- x3 ) AND ;
: XOR ( x1 x2 -- x3 ) XOR ;
`;

export const BLOCK_COMMON_CONSTANTS = `
( --- MEMORY MAP --- )
HEX
400   CONSTANT INPUT_QUEUE
10400 CONSTANT OUTPUT_QUEUE
70000 CONSTANT STR_BUF_START
7FFFF CONSTANT STR_BUF_END
D0000 CONSTANT TEMP_VSO_BUFFER
DECIMAL

( --- DYNAMIC ALLOCATOR MEMORY MAP --- )
HEX
100000 CONSTANT HEAP_START
200000 CONSTANT HEAP_END
DECIMAL
64 CONSTANT CHUNK_CAPACITY_BYTES
16 CONSTANT CHUNK_CAPACITY_CELLS

${generateForthProtocolBlock()}
`;

export const BLOCK_MSG_REGISTERS = `
VARIABLE MY_ID
0 MY_ID !

VARIABLE HANDLE_EVENTS_XT
' NOOP HANDLE_EVENTS_XT !

VARIABLE M_OP
VARIABLE M_SENDER
VARIABLE M_TARGET
VARIABLE M_P1
VARIABLE M_P2
VARIABLE M_P3
VARIABLE LAST_PLAYER_X
VARIABLE LAST_PLAYER_Y

: UNPACK_MSG
  M_P3 !
  M_P2 !
  M_P1 !
  M_TARGET !
  M_SENDER !
  M_OP !
;
`;

export const BLOCK_STRING_PRIMITIVES = `
( --- STRING PRIMITIVES --- )
VARIABLE STR_PTR
STR_BUF_START STR_PTR !

( Append string to circular buffer to ensure it persists for JS call )
( FIXED v1.12: Corrected CMOVE argument order )
: S+ ( addr len -- dest len )
  ( Check bounds: Reset to start if buffer full )
  DUP STR_PTR @ + STR_BUF_END > IF STR_BUF_START STR_PTR ! THEN
  
  STR_PTR @ >R       ( Save Dest to R-stack )
  
  ( src=addr dest=R@ u=len )
  OVER R@ 2 PICK CMOVE

  ( Update Pointer )
  DUP STR_PTR +!
  
  ( Return dest len )
  NIP R> SWAP
;

( Convert Number to String )
: N>S ( n -- addr len )
  DUP >R ABS 0 <# #S R> SIGN #> S+
;
`;

export const BLOCK_STRING_IO = `
( --- STRING IO --- )

( Print String to JS Console - Requires JS_LOG bound )
: S. ( addr len -- )
  S+ JS_LOG
;

( Print Number to JS Console )
: .N ( n -- )
  N>S S.
;

( Dump Stack to Log )
: .S ( -- )
  DEPTH N>S S. S"  Items on stack" S.
;
`;

export const BLOCK_BUS_UTILS = `
( --- BUS UTILITIES --- )
VARIABLE OUT_PTR
0 OUT_PTR !

( Write a 6-Cell Packet to Output Queue )
: BUS_SEND ( op sender target p1 p2 p3 -- )
  OUTPUT_QUEUE 4 + OUT_PTR @ CELLS + >R
  
  ( Stack: op sender target p1 p2 p3 )
  ( Use Return Stack to hold address )
  R@ 20 + ! ( p3 )
  R@ 16 + ! ( p2 )
  R@ 12 + ! ( p1 )
  R@ 8 + !  ( target )
  R@ 4 + !  ( sender )
  R@ !      ( op )
  R> DROP   ( Clean R stack )
  
  6 OUT_PTR +!
  OUT_PTR @ OUTPUT_QUEUE ! ( Update Count )
;

: BUS_READ_INPUT ( -- count )
  INPUT_QUEUE @
;

: GET_MSG_ADDR ( index -- addr )
  INPUT_QUEUE 4 + SWAP CELLS +
;

( --- PERSISTENCE HELPERS --- )
( Store HERE at fixed location 0x3F0 for JS readout )
: SYNC_HERE HERE 1008 ! ;

( --- BLOB EXTENSION v2.0 --- )
( Send Variable Length Data )
( Stack: data_addr data_len sender target real_op -- )
: BUS_SEND_BLOB
  OUTPUT_QUEUE 4 + OUT_PTR @ CELLS + >R
  
  ( 1. Write Header: SYS_BLOB sender target len real_op 0 )
  0               R@ 20 + ! ( p3: unused )
  DUP             R@ 16 + ! ( p2: real_op )
  3 PICK          R@ 12 + ! ( p1: len )
  3 PICK          R@ 8 + !  ( target )
  4 PICK          R@ 4 + !  ( sender )
  SYS_BLOB        R@ !      ( op: SYS_BLOB )
  
  ( 2. Write Payload )
  ( Addr of payload start in queue = R@ + 24 )
  R@ 24 +      ( dest_addr )
  5 ROLL       ( dest_addr data_addr )
  5 ROLL       ( dest_addr data_addr len )
  
  ( Copy Memory: cells to bytes )
  DUP >R       ( Save len for ptr update )
  CELLS CMOVE
  
  R> DROP      ( Clean len )
  R> DROP      ( Clean R-Stack header addr )
  
  ( 3. Update Pointer: 6 + Len )
  SWAP DROP ( Clean real_op )
  6 + OUT_PTR +!
  OUT_PTR @ OUTPUT_QUEUE ! 
;
`;

export const BLOCK_STANDARD_INBOX = `
( --- STANDARD INBOX PROCESSOR v2.0 --- )
( Replaces individual Kernel processors to handle Blobs )

: PROCESS_INBOX
  0 OUT_PTR !
  BUS_READ_INPUT ( total_count )
  0 ( total_count current_offset )
  
  BEGIN 2DUP > WHILE
    DUP GET_MSG_ADDR >R ( R: addr )
    
    R@ @ ( op )
    DUP SYS_BLOB = IF
       ( --- IT IS A BLOB --- )
       DROP ( drop op )
       ( Packet: [ BLOB, SENDER, TARGET, LEN, REAL_OP, 0 ] [ ...DATA... ] )
       
       ( 1. Setup Registers with Real Op )
       R@ 16 + @ M_OP ! ( Real Op )
       R@ 4 + @ M_SENDER !
       R@ 8 + @ M_TARGET !
       R@ 12 + @ M_P1 ! ( Length )
       
       ( 2. Set M_P2 to Point to Data Payload )
       R@ 24 + M_P2 ! 
       
       ( 3. Run Handler )
       HANDLE_EVENTS_XT @ EXECUTE
       
       ( 4. Calc Step: 6 + Length )
       M_P1 @ 6 + 
    ELSE
       ( --- STANDARD PACKET --- )
       DROP ( drop op )
       R@ @ R@ 4 + @ R@ 8 + @ R@ 12 + @ R@ 16 + @ R@ 20 + @
       UNPACK_MSG
       HANDLE_EVENTS_XT @ EXECUTE
       6
    THEN
    
    R> DROP ( clean R )
    + ( Add step to current_offset )
  REPEAT
  2DROP
  0 INPUT_QUEUE ! ( Clear Count )
;
`;

export const BLOCK_MEMORY_ALLOCATOR = `
( --- GLOBAL FREE-LIST ALLOCATOR --- )
VARIABLE FREE_CHUNK_HEAD
VARIABLE HEAP_INITIALIZED

( Initialize the Heap - split into chunks )
: INIT_HEAP
  HEAP_INITIALIZED @ IF EXIT THEN
  1 HEAP_INITIALIZED !
  HEAP_START FREE_CHUNK_HEAD !
  HEAP_START
  BEGIN
    DUP CHUNK_CAPACITY_BYTES + HEAP_END < WHILE
    DUP CHUNK_CAPACITY_BYTES + ( next_chunk_addr )
    OVER ! ( write next_chunk_addr into current chunk's 1st cell )
    CHUNK_CAPACITY_BYTES +
  REPEAT
  0 SWAP ! ( tail chunk points to 0 )
;

( Allocate 1 Chunk: returns addr )
: ALLOC_CHUNK
  FREE_CHUNK_HEAD @ DUP 0= IF
    ( OUT OF MEMORY )
    JS_ERR DROP 0 EXIT
  THEN
  DUP @ FREE_CHUNK_HEAD ! ( Pop from free list )
  0 OVER ! ( Clear next_ptr just in case )
;

( Free 1 Chunk )
: FREE_CHUNK ( addr -- )
  FREE_CHUNK_HEAD @ OVER ! ( Set chunk.next = head )
  FREE_CHUNK_HEAD ! ( head = chunk )
;

( Free a Linked-List of Chunks )
: FREE_CHUNKS ( head tail -- )
  ( tail.next = FREE_CHUNK_HEAD )
  FREE_CHUNK_HEAD @ OVER !
  DROP ( DROP old tail )
  ( FREE_CHUNK_HEAD = head )
  FREE_CHUNK_HEAD !
;

( Fat Pointer Structure )
( struct ArrayFatPtr { head: addr, tail: addr, length: cell } )
( length is stored inside the Fat Ptr itself or head chunk, let's keep it simple: )
( Head chunk cell 0: next_chunk )
( Data starts at cell 1 )

( Calculate address of array element i )
( Stack: head_ptr index -- addr )
: ARRAY_GET_ADDR
  ( Each chunk has 1 cell for next_ptr, 15 cells for data )
  ( index / 15 = chunk_hops )
  ( index % 15 = cell_offset )
  DUP 15 / >R ( save chunk_hops )
  15 MOD 1+ CELLS ( calculate byte offset in chunk: skip next_ptr )
  SWAP
  ( traverse chunks )
  R>
  ( Better to use BEGIN WHILE instead of ?DO because WAForth doesn't support ?DO natively or acts weirdly. )
  ( Stack: offset current_chunk target_hops )
  0
  ( Stack: offset current_chunk target_hops current_hops )
  BEGIN
    2DUP >
  WHILE
    ROT @ -ROT ( current_chunk = current_chunk.next )
    ROT DUP 0= IF
      ( OOB )
      JS_ERR
    THEN
    -ROT
    1 +
  REPEAT
  2DROP ( drop target_hops, current_hops )
  + ( addr + offset )
;

( String Append - very basic string implementation )
: STR_CONCAT
  ( TODO )
;

: STR_CMP
  ( TODO )
;
`;

// --- UNIFIED FIRMWARE PACKAGE ---
// Inject this into every kernel to ensure standard library availability.
export const STANDARD_KERNEL_FIRMWARE = [
  BLOCK_HOST_BINDINGS,
  BLOCK_CORE_POLYFILLS,
  BLOCK_MATH,
  BLOCK_COMMON_CONSTANTS,
  BLOCK_MSG_REGISTERS,
  BLOCK_STRING_PRIMITIVES,
  BLOCK_STRING_IO,
  BLOCK_BUS_UTILS,
  BLOCK_MEMORY_ALLOCATOR
];
