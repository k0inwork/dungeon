# ASSET MANIFEST: THE GLYPH REGISTRY (v1.0)

> **Philosophy:** "A picture is worth 1000 words. A letter is worth 1 byte."
> **System:** The AI generates Glyphs, not filenames.

## 1. THE ASSET SCHEMA

When the AI generates an Entity or Particle, it provides this struct:

```typescript
type Glyph = {
  char: string; // Single character (ASCII or Unicode)
  color: string; // Hex Code (#RRGGBB)
  bgColor?: string; // Optional Background (for fluids/solid walls)
}
```

## 2. STANDARD LIBRARY (The Defaults)

The engine provides these defaults if the AI fails to specify one.

| Category | Symbol | Color | Meaning |
| :--- | :--- | :--- | :--- |
| **Player** | `@` | `#FFFFFF` | The Hero |
| **Enemy** | `a-z` | `#FF0000` | Generic Hostiles (g=goblin, d=dragon) |
| **Item** | `?` | `#FFFF00` | Unknown Item |
| **Weapon** | `/` | `#00FFFF` | Swords, Wands |
| **Armor** | `[` | `#00FF00` | Shields, Plate |
| **Wall** | `#` | `#555555` | Impassable Stone |
| **Floor** | `.` | `#222222` | Walkable |
| **Fire** | `&` | `#FF5500` | Hazard |
| **Water** | `~` | `#0000FF` | Fluid |

## 3. VFX PARTICLES

The Wasm visual cortex emits particle events using these codes.

| ID | Symbol | Logic |
| :--- | :--- | :--- |
| **VFX_SPARK** | `*` | Quick fade, yellow. |
| **VFX_BLOOD** | `%` | Stays on floor, red. |
| **VFX_SMOKE** | `°` | Floats up, gray. |
| **VFX_MAGIC** | `+` | Rotates color. |
