# CONTEXT: TERRAIN & GEOGRAPHY

> **Instruction:** Use this to generate `Biomes` and `MapGen` rules.

## 1. THE DOMAIN MANIFOLD
Terrain determines the *Physics Kernel* used.
*   **ORTHOGONAL:** Standard grid.
*   **GRAVITY:** Side-view. `Y-` is up. `Y+` is gravity.

## 2. TILE DEFINITIONS
A Biome consists of a mapping of Symbols to Mechanics.

| Symbol | Name | Passable? | Opaque? | Special Effect |
| :--- | :--- | :--- | :--- | :--- |
| `.` | Floor | Yes | No | Cost 1.0 |
| `#` | Wall | No | Yes | None |
| `~` | Liquid | Context | No | Cost 2.0 or Drown |
| `+` | Door | Yes | Yes | Interact to Open |
| `^` | Trap | Yes | No | Triggers Script on Enter |

## 3. BIOME GENERATION
A generated Biome must define:
1.  **Palette:** The visual ASCII/Unicode chars.
2.  **Traversal Rules:** Does Liquid damage you? Is it slippery?
3.  **Hazard Script:** A script attached to Trap tiles (e.g., "Explode for 10 Thermal Damage").
