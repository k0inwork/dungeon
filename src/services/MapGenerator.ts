
import { EntityDef, TerrainDef } from "./GeneratorService";

export interface GeneratedMap {
  layout: string[]; // The ASCII grid
  playerStart: { x: number, y: number };
  entities: EntityDef[]; // Entities with updated X/Y
}

export class MapGenerator {
  private width: number;
  private height: number;
  private rng: () => number;

  constructor(width: number, height: number, seedStr: string) {
    this.width = width;
    this.height = height;
    // Simple seeded RNG
    let h = 0xdeadbeef;
    for(let i = 0; i < seedStr.length; i++) 
      h = Math.imul(h ^ seedStr.charCodeAt(i), 2654435761);
    this.rng = () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h >>> 0) / 4294967296;
    }
  }

  generate(entityRoster: EntityDef[], terrainLegend: TerrainDef[]): GeneratedMap {
    // 1. Initialize Noise Grid (0 = Floor, 1 = Wall)
    let grid: number[][] = [];
    for (let y = 0; y < this.height; y++) {
      let row = [];
      for (let x = 0; x < this.width; x++) {
        // Edges are always walls
        if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
          row.push(1);
        } else {
          // 45% chance of wall
          row.push(this.rng() < 0.45 ? 1 : 0);
        }
      }
      grid.push(row);
    }

    // 2. Cellular Automata Smoothing (5 iterations)
    // Rule: Become wall if neighbors > 4, else become floor
    for (let i = 0; i < 5; i++) {
      const newGrid = grid.map(row => [...row]);
      for (let y = 1; y < this.height - 1; y++) {
        for (let x = 1; x < this.width - 1; x++) {
          let neighbors = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              neighbors += grid[y + dy][x + dx];
            }
          }
          if (neighbors > 4) newGrid[y][x] = 1;
          else if (neighbors < 4) newGrid[y][x] = 0;
        }
      }
      grid = newGrid;
    }

    // 3. Find Open Spaces (Floors)
    const floors: {x: number, y: number}[] = [];
    for(let y=0; y<this.height; y++) {
      for(let x=0; x<this.width; x++) {
        if(grid[y][x] === 0) floors.push({x, y});
      }
    }

    // 4. Place Player (Center-ish)
    // Naive: Just pick a random floor spot
    const playerStart = floors.length > 0 
      ? floors[Math.floor(this.rng() * floors.length)] 
      : { x: 1, y: 1 };
    
    // Track occupied spots to prevent stacking
    const occupied = new Set<string>();
    occupied.add(`${playerStart.x},${playerStart.y}`);

    const placedEntities: EntityDef[] = [];
    
    // 5A. Place LOOT (Items) - Fixed: Type 3
    const lootCount = 3 + Math.floor(this.rng() * 3); // 3 to 5 items
    for(let i=0; i<lootCount; i++) {
        if (floors.length === 0) break;
        const spot = floors[Math.floor(this.rng() * floors.length)];
        
        if (!occupied.has(`${spot.x},${spot.y}`)) {
            occupied.add(`${spot.x},${spot.y}`);
            // Manually construct Loot Entity
            // Note: In GeneratorService/GridKernel, Type 3 is Item.
            // Char 36 is '$', Color Gold
            placedEntities.push({
                id: `loot_${i}`,
                name: "Lost Treasure",
                x: spot.x,
                y: spot.y,
                taxonomy: { race: "Item", class: "Loot", origin: "World" },
                stats: { hp: 1, speed: 0 },
                glyph: { char: "$", color: 0xFFD700 },
                scripts: { passive: "", active: [] }
            });
            // HACK: We need a way to tell the Engine this is Type 3 (Item).
            // Currently GridKernel infers type from entity_roster or generation logic.
            // For now, we rely on the `glyph` being passed. 
            // In `App.tsx`, we loop these. We should add a special check there or here.
            // Actually, `App.tsx` calls `SPAWN_ENTITY` with `type`.
            // We will need to detect this in App.tsx or encode it in ID.
        }
    }

    // 5B. Place HOSTILES
    const entityCount = 8 + Math.floor(this.rng() * 5); // 8 to 12 enemies
    
    if (entityRoster.length > 0 && floors.length > 0) {
      for(let i=0; i<entityCount; i++) {
        const template = entityRoster[Math.floor(this.rng() * entityRoster.length)];
        
        // Try up to 10 times to find a free spot
        let spot = floors[Math.floor(this.rng() * floors.length)];
        let attempts = 0;
        while (occupied.has(`${spot.x},${spot.y}`) && attempts < 10) {
             spot = floors[Math.floor(this.rng() * floors.length)];
             attempts++;
        }
        
        if (!occupied.has(`${spot.x},${spot.y}`)) {
            occupied.add(`${spot.x},${spot.y}`);
            placedEntities.push({
              ...template,
              id: `${template.id}_${i}`,
              x: spot.x,
              y: spot.y
            });
        }
      }
    }

    // 6. Convert to ASCII
    // Get symbols from legend
    const wallDef = terrainLegend.find(t => t.type === "WALL") || { symbol: '#' };
    const floorDef = terrainLegend.find(t => t.type === "FLOOR") || { symbol: '.' };

    const layout: string[] = [];
    for(let y=0; y<this.height; y++) {
      let line = "";
      for(let x=0; x<this.width; x++) {
        if (x === playerStart.x && y === playerStart.y) {
          line += "@";
        } else {
          line += grid[y][x] === 1 ? wallDef.symbol : floorDef.symbol;
        }
      }
      layout.push(line);
    }

    return {
      layout,
      playerStart,
      entities: placedEntities
    };
  }
}
