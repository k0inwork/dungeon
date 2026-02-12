# TRANSPILER SPECIFICATION: AETHERSCRIPT (v3.3)

> **Status:** APPROVED DESIGN
> **Context:** Interpreter Model.
> **Inputs:** AetherJS (JS Subset) or AetherPy (Python Subset).
> **Output:** Forth Source/Bytecode (Text string to be consumed by WAForth).

## 1. PURPOSE
To convert AI-generated high-level code (**AetherJS** or **AetherPy**) into a Forth String that the **WAForth** interpreter inside the Kernel can compile into its own dictionary at runtime.

## 2. EXECUTION STRATEGY

1.  **AI:** Generates `function Fireball() { ... }`
2.  **Transpiler:** Converts to String `: FIREBALL ... ;`
3.  **React:** Passes String to Wasm: `forth.interpret(": FIREBALL ... ;")`
4.  **Wasm:** WAForth compiles this into efficient threaded code in Wasm memory.
5.  **Runtime:** We can now call `FIREBALL` by name or execution token.

## 3. VERB IMPLEMENTATION STRATEGY

In the v3.1 model, verbs primarily push to the **Output Queue** (for Visuals) or modify **Kernel State** (for Stats).

### 3.1 Internal Action Verbs (State Mutation)
These modify the Simulation State immediately.

*   `CMD_DAMAGE ( amount type target_ptr -- )`
    *   *Logic:* Reduces `Target->HP`.
    *   *Side Effect:* If HP <= 0, pushes `EVT_DIED` to Output Queue.
    *   *Side Effect:* Always pushes `EVT_DAMAGED` to Output Queue (for UI numbers).
*   `CMD_HEAL ( amount target_ptr -- )`
*   `CMD_TELEPORT ( entity_ptr x y -- )`
    *   *Logic:* Updates `Entity->X/Y`. Rehashes Spatial Map.
    *   *Side Effect:* Pushes `EVT_MOVED` to Output Queue.

### 3.2 Visual Verbs (Event Generation)
These purely push data to the `OUTPUT_QUEUE` for the Host JS.

*   `CMD_TRIGGER_VFX ( x y effect_id -- )`
    *   *Forth:* `EVT_VFX ROT ROT ROT PUSH_EVENT`
*   `CMD_PLAY_SOUND ( sound_id -- )`
*   `CMD_LOG ( string_id -- )`

### 3.3 Environmental Verbs
*   `CMD_SET_TILE ( tile_type_id x y -- )`
    *   *Logic:* Updates `GRID_TILES`.
    *   *Side Effect:* Pushes `EVT_TILE_CHANGED` to Output Queue (so Host JS knows to redraw the tile).

---

## 4. COMPILATION MAPPING

The Transpiler maps **AetherJS** concepts to Kernel Words.

| AetherJS Concept | Forth Word | Implementation |
| :--- | :--- | :--- |
| `Source` | `GET_CTX_SOURCE` | Fetches Entity Pointer from `0x0000` |
| `Target` | `GET_CTX_TARGET` | Fetches Entity Pointer from `0x0004` |
| `let x = 5` | `5 SET_REG_0` | Stores 5 in `CTX_REGISTERS[0]` |
| `x` | `GET_REG_0` | Pushes `CTX_REGISTERS[0]` to stack |

---

## 5. EXAMPLE: "Meteor Strike"

```javascript
// AetherJS Source (AI Generated)
function cast() {
  TriggerVFX(Target.X, Target.Y, VFX_METEOR_FALL);
  Damage(Target, 50, TYPE_FIRE);
  SetTile(Target.X, Target.Y, TILE_CRATER);
}
```

```python
# AetherPy Source (AI Generated)
def cast():
  TriggerVFX(Target.X, Target.Y, VFX_METEOR_FALL)
  Damage(Target, 50, TYPE_FIRE)
  SetTile(Target.X, Target.Y, TILE_CRATER)
```

```forth
\ Compiled Forth String (Sent to Wasm Interpreter)
: CAST_METEOR
  \ 1. Visuals -> Output Queue
  GET_CTX_TARGET -> t
  t ENT_Y @ t ENT_X @ VFX_METEOR_FALL CMD_TRIGGER_VFX

  \ 2. Logic -> Internal State + Output Queue
  50 TYPE_FIRE t CMD_DAMAGE

  \ 3. Terrain -> Internal State + Output Queue
  TILE_CRATER t ENT_Y @ t ENT_X @ CMD_SET_TILE
;
```
