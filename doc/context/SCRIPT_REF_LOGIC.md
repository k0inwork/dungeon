# CONTEXT: NARRATIVE SCRIPTING (LOGIC KERNEL)

> **Context:** Use this reference when generating scripts for `MUD`, `DETECTIVE`, or `PUZZLE` manifolds.
> **Kernel:** `kernels/logic_core.fs` (Stateless Executor).
> **State:** Held in `GameState.flags` and `GameState.inventory` (JS Side).

## 1. THE NARRATIVE PHILOSOPHY
In this manifold, there is no Grid, no Physics, and no HP.
**Action = State Mutation + Text Output.**

The goal of a script is to:
1.  Check **Flags** (Preconditions).
2.  Print **Log** (Narrative).
3.  Set **Flags** or **Inventory** (Consequences).
4.  Trigger **Transition** (Movement).

## 2. THE API (Verbs)

### State Actions
*   `SetFlag(flag_name, value)`: Sets a global boolean or integer flag.
    *   *Ex:* `SetFlag("DOOR_UNLOCKED", 1)`
*   `AddItem(item_id)`: Adds item to player inventory.
*   `RemoveItem(item_id)`: Removes item.
*   `Pay(amount)`: Deducts currency.

### Narrative Actions
*   `Log(text)`: Prints description to the terminal.
*   `Clear()`: Clears the terminal (useful for room transitions).
*   `Dialog(speaker_name, text)`: Prints formatted dialogue.

### Navigation Actions
*   `GoTo(node_id)`: Moves player to a new "Room" or "Node".
*   `EndGame(outcome_id)`: Triggers game over (Victory/Death).

## 3. READ-ONLY ACCESSORS

*   `HasFlag(flag_name)`: Returns true/false.
*   `GetFlag(flag_name)`: Returns integer value.
*   `HasItem(item_id)`: Returns true/false.
*   `Roll(max)`: Returns random int 0 to max-1.

## 4. EXAMPLE SCRIPTS

### A. The Locked Door (Interact Script)
```javascript
// Triggered when user selects [OPEN DOOR]
if (HasItem("rusty_key")) {
    Log("The key turns with a grind. The door opens.");
    RemoveItem("rusty_key");
    SetFlag("bunker_open", 1);
    GoTo("bunker_interior");
} else {
    Log("It's locked. The keyhole is rusted shut.");
}
```

### B. The Interrogation (Dialogue Script)
```javascript
// Triggered when user asks "Where were you?"
if (HasFlag("found_murder_weapon")) {
    Dialog("Suspect", "Fine! I did it! Just keep that knife away from me!");
    SetFlag("confession_signed", 1);
} else {
    Dialog("Suspect", "I don't know what you're talking about, detective.");
}
```

### C. The Random Encounter (Travel Script)
```javascript
// Triggered on Enter Node
if (Roll(100) < 20) {
    Log("A thug jumps from the shadows!");
    // Transition to Combat Manifold
    StartCombat("enemy_thug_01"); 
} else {
    Log("The street is quiet.");
}
```
