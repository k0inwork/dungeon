# CONTEXT: AETHER SCRIPT CHEATSHEET

> **Instruction:** Write logic in **JavaScript (ES5)** or **Python (3)**. The engine transpiles it to WebAssembly.

## 1. CONTEXT OBJECTS (Data Access)
You have access to two global objects: `Source` (Initiator) and `Target` (Receiver).

### Source (The Caster / Attacker)
*   `Source.HP` -> int
*   `Source.Energy` -> int
*   `Source.ResourceA` -> int (Gold/Ammo)
*   `Source.Visibility` -> int (0-100)
*   `Source.Carrying` -> int (ID of held item, or 0)
*   `Source.Elevation` -> int (Z-Height)
*   `Source.HasTag("TAG_NAME")` -> bool
*   `Source.ID` -> int

### Target (The Victim / Defender / Merchant)
*   `Target.HP` -> int
*   `Target.ResourceA` -> int
*   `Target.Visibility` -> int
*   `Target.Elevation` -> int
*   `Target.HasTag("TAG_NAME")` -> bool
*   `Target.ID` -> int

## 2. API ACTIONS (Verbs)

### Combat Actions
*   `Damage(amount, typeId)`: Deals damage to `Target`.
*   `Heal(amount)`: Heals `Target`.
*   `Push(tiles)`: Pushes `Target` away from `Source`.
*   `Reflect(amount, range)`: (Defense Only) Queues a reflection.
*   `Chain(amount, range, typeId)`: Auto-targets nearest enemy.

### Immersive Physics (New)
*   `Transmute(x, y, newTileId, spawnEntityId)`: Changes terrain and optionally spawns an item (e.g., Tree -> Stump + Log).
*   `Take(Target)`: Picks up the target Entity. `Source.Carrying` becomes `Target.ID`.
*   `Drop()`: Drops the currently held item at Source's feet.
*   `Throw(range)`: Throws held item. Projectile damage based on Item Weight.

### Sensory & Logic
*   `CanSee(Target)`: Returns `true` if Source perceives Target.
*   `AwaitPhrase(hash, prompt)`: Pauses script until user types correct phrase matching hash.
*   `ModStat(statId, amount)`: Buffs/Debuffs specific stats.

### Narrative & Visuals
*   `VFX(effectId)`: Plays a visual effect.
*   `Shout(stringLiteral)`: Pauses combat for dialogue.

## 3. EXAMPLES

### Harvesting Script: "Mining Pick"
```javascript
// Logic: If target is rock, destroy it and spawn Ore.
if (GetTileType(TargetX, TargetY) == TILE_ROCK) {
   VFX(CRUSH_ROCK);
   Transmute(TargetX, TargetY, TILE_RUBBLE, ENTITY_IRON_ORE);
}
```

### Puzzle Script: "Weight Plate"
```javascript
// Logic: Runs when an entity steps on the tile.
// If the entity is heavy (Object or Armored), open door.
if (Source.HasTag("HEAVY")) {
   Shout("Click.");
   Transmute(10, 15, TILE_OPEN_DOOR, 0); // Open door at 10,15
}
```

### Riddle Guardian
```javascript
Shout("What runs but never walks?");
if (AwaitPhrase(HASH_RIVER, "Answer:")) {
   Shout("Correct.");
   Teleport(Source, 20, 20); // Warp player to treasure
} else {
   Damage(50, TYPE_COGNITIVE);
}
```
