: ARRAY_GET_ADDR ( head index -- addr )
  15 / >R
  15 MOD 1+ CELLS SWAP
  R> 0 BEGIN 2DUP > WHILE
    ROT @ -ROT 1+
  REPEAT
  2DROP +
;
