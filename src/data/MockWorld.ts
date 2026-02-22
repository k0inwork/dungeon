
import { WorldData, LevelData } from "../services/GeneratorService";

const HUB_LEVEL: LevelData = {
    id: "hub",
    name: "The Neon-Hub",
    description: "A safe zone with portals to other sectors.",
    simulation_mode: "GRID",
    map_layout: [
      "########################################",
      "#@.....................................#",
      "#......................................#",
      "#.........[P]..........................#",
      "#........DUNGEONS......................#",
      "#......................................#",
      "#......................................#",
      "#......................................#",
      "#......................................#",
      "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Polished Floor", type: "FLOOR", color: 0x222222, passable: true, description: "Clean and safe." },
      { symbol: "#", name: "Hub Wall", type: "WALL", color: 0x444444, passable: false, description: "Reinforced steel." },
      { symbol: "P", name: "DUNGEONS Portal", type: "GATE", color: 0xFF00FF, passable: true, description: "To the Upper Platformer.", target_id: 1 },
      { symbol: "[", name: "Bracket", type: "WALL", color: 0x555555, passable: false, description: "Decor." },
      { symbol: "]", name: "Bracket", type: "WALL", color: 0x555555, passable: false, description: "Decor." }
    ],
    entities: [],
    entity_roster: [],
    platformer_config: { gravity: 5000, jump_force: -75000, wall_color: 0x444444 }
};

const PLATFORMER_1: LevelData = {
    id: "platformer_1",
    name: "Upper Platformer",
    description: "The first vertical descent.",
    simulation_mode: "PLATFORM",
    map_layout: [
      "########################################",
      "#@.....................................#",
      "#######................................#",
      "#............#######...................#",
      "#.......................#######........#",
      "#......................................#",
      "#....................................XX#",
      "#....................................>>#",
      "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Air", type: "FLOOR", color: 0x111111, passable: true, description: "Empty space." },
      { symbol: "#", name: "Platform", type: "WALL", color: 0xAAAAAA, passable: false, description: "Steel platform." },
      { symbol: ">", name: "Exit", type: "GATE", color: 0x00FF00, passable: true, description: "To the Roguelike Mid-Level.", target_id: 2 },
      { symbol: "X", name: "Exit Area", type: "FLOOR", color: 0x004400, passable: true, description: "Safe to exit here." }
    ],
    entities: [
        { id: "frog_1", x: 10, y: 2, taxonomy: { race: "Frog", class: "Passive", origin: "None" }, stats: { hp: 10, speed: 10 }, glyph: { char: "f", color: 0x00FF00 }, scripts: { passive: "wander", active: [] } },
        { id: "frog_2", x: 25, y: 3, taxonomy: { race: "Frog", class: "Aggressive", origin: "None" }, stats: { hp: 20, speed: 10 }, glyph: { char: "F", color: 0xFF5555 }, scripts: { passive: "aggressive", active: [] } },
        { id: "loot_1", x: 15, y: 1, taxonomy: { race: "Loot", class: "None", origin: "None" }, stats: { hp: 1, speed: 0 }, glyph: { char: "$", color: 0xFFFF00 }, scripts: { passive: "treasure", active: [] } }
    ],
    entity_roster: [],
    platformer_config: { gravity: 5000, jump_force: -75000, wall_color: 0xAAAAAA }
};

const ROGUELIKE_LEVEL: LevelData = {
    id: "roguelike",
    name: "Roguelike Crossroads",
    description: "Choose your path through the descent.",
    simulation_mode: "GRID",
    map_layout: [
      "########################################",
      "#@.................#...................#",
      "#######............#...................#",
      "#..................#...................#",
      "#......#############......##############",
      "#......#...............................#",
      "#......#...............................#",
      "#..#####...............................#",
      "#..#...................................#",
      "#L #..........###########..............#",
      "#L #..........#.........#..............#",
      "#..#..........#.........#..............#",
      "#..############.........#..............#",
      "#.......................#..............#",
      "#......................................#",
      "#......##################..............#",
      "#......#...............................#",
      "#......#..............................R#",
      "#......#..............................R#",
      "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Concrete", type: "FLOOR", color: 0x444444, passable: true, description: "Wet floor." },
      { symbol: "#", name: "Rusted Wall", type: "WALL", color: 0x885555, passable: false, description: "Iron and rust." },
      { symbol: "L", name: "Left Path", type: "GATE", color: 0x00FF00, passable: true, description: "To Platformer 2.", target_id: 3 },
      { symbol: "R", name: "Right Path", type: "GATE", color: 0x00FF00, passable: true, description: "To Platformer 1 Lower.", target_id: 4 }
    ],
    entities: [
        { id: "rat_1", x: 10, y: 3, taxonomy: { race: "Rat", class: "None", origin: "None" }, stats: { hp: 10, speed: 10 }, glyph: { char: "r", color: 0x888888 }, scripts: { passive: "wander", active: [] } },
        { id: "rat_2", x: 15, y: 6, taxonomy: { race: "Rat", class: "None", origin: "None" }, stats: { hp: 10, speed: 10 }, glyph: { char: "r", color: 0x888888 }, scripts: { passive: "wander", active: [] } },
        { id: "rat_3", x: 25, y: 15, taxonomy: { race: "Rat", class: "None", origin: "None" }, stats: { hp: 10, speed: 10 }, glyph: { char: "r", color: 0x888888 }, scripts: { passive: "wander", active: [] } },
        { id: "giant_rat_1", x: 20, y: 10, taxonomy: { race: "Giant Rat", class: "None", origin: "None" }, stats: { hp: 30, speed: 10 }, glyph: { char: "R", color: 0xFF5555 }, scripts: { passive: "aggressive", active: [] } },
        { id: "giant_rat_2", x: 30, y: 5, taxonomy: { race: "Giant Rat", class: "None", origin: "None" }, stats: { hp: 30, speed: 10 }, glyph: { char: "R", color: 0xFF5555 }, scripts: { passive: "aggressive", active: [] } },
        { id: "loot_1", x: 15, y: 13, taxonomy: { race: "Loot", class: "None", origin: "None" }, stats: { hp: 1, speed: 0 }, glyph: { char: "$", color: 0xFFFF00 }, scripts: { passive: "treasure", active: [] } },
        { id: "loot_2", x: 35, y: 17, taxonomy: { race: "Loot", class: "None", origin: "None" }, stats: { hp: 1, speed: 0 }, glyph: { char: "$", color: 0xFFFF00 }, scripts: { passive: "treasure", active: [] } }
    ],
    entity_roster: [],
    platformer_config: { gravity: 5000, jump_force: -75000, wall_color: 0x885555 }
};

const PLATFORMER_2: LevelData = {
    id: "platformer_2",
    name: "Platformer 2 (2 exits)",
    description: "One path leads to the core, the other back home.",
    simulation_mode: "PLATFORM",
    map_layout: [
      "########################################",
      "#@.....................................#",
      "#######................................#",
      "#....................................XX#",
      "#............#######.................HH#",
      "#....................................XX#",
      "#....................................EE#",
      "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Air", type: "FLOOR", color: 0x111111, passable: true, description: "Empty space." },
      { symbol: "#", name: "Platform", type: "WALL", color: 0xAAAAAA, passable: false, description: "Steel platform." },
      { symbol: "H", name: "Hub Portal", type: "GATE", color: 0x00FF00, passable: true, description: "Back to Hub.", target_id: 0 },
      { symbol: "E", name: "Exit Portal", type: "GATE", color: 0x00FF00, passable: true, description: "Back to Hub.", target_id: 0 },
      { symbol: "X", name: "Exit Area", type: "FLOOR", color: 0x004400, passable: true, description: "Safe to exit here." }
    ],
    entities: [
        { id: "frog_3", x: 15, y: 3, taxonomy: { race: "Frog", class: "Aggressive", origin: "None" }, stats: { hp: 20, speed: 10 }, glyph: { char: "F", color: 0xFF5555 }, scripts: { passive: "aggressive", active: [] } },
        { id: "loot_2", x: 20, y: 3, taxonomy: { race: "Loot", class: "None", origin: "None" }, stats: { hp: 1, speed: 0 }, glyph: { char: "$", color: 0xFFFF00 }, scripts: { passive: "treasure", active: [] } }
    ],
    entity_roster: [],
    platformer_config: { gravity: 5000, jump_force: -75000, wall_color: 0xAAAAAA }
};

const PLATFORMER_1_LOWER: LevelData = {
    id: "platformer_1_lower",
    name: "Platformer 1 Lower",
    description: "The direct path to the core.",
    simulation_mode: "PLATFORM",
    map_layout: [
      "########################################",
      "#@.....................................#",
      "#######................................#",
      "#............#######...................#",
      "#.......................#######........#",
      "#....................................XX#",
      "#....................................EE#",
      "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Air", type: "FLOOR", color: 0x111111, passable: true, description: "Empty space." },
      { symbol: "#", name: "Platform", type: "WALL", color: 0xAAAAAA, passable: false, description: "Steel platform." },
      { symbol: "E", name: "Exit", type: "GATE", color: 0x00FF00, passable: true, description: "Back to Hub.", target_id: 0 },
      { symbol: "X", name: "Exit Area", type: "FLOOR", color: 0x004400, passable: true, description: "Safe to exit here." }
    ],
    entities: [
        { id: "frog_4", x: 5, y: 1, taxonomy: { race: "Frog", class: "Passive", origin: "None" }, stats: { hp: 10, speed: 10 }, glyph: { char: "f", color: 0x00FF00 }, scripts: { passive: "wander", active: [] } },
        { id: "frog_5", x: 20, y: 3, taxonomy: { race: "Frog", class: "Aggressive", origin: "None" }, stats: { hp: 20, speed: 10 }, glyph: { char: "F", color: 0xFF5555 }, scripts: { passive: "aggressive", active: [] } }
    ],
    entity_roster: [],
    platformer_config: { gravity: 5000, jump_force: -75000, wall_color: 0xAAAAAA }
};

export const MOCK_WORLD_DATA: WorldData = {
  theme: {
    name: "Aethelgard Underworld",
    lore: "The sprawling megacity's forgotten basement."
  },
  taxonomy: {
    races: [
      {
        name: "Sewer-Dwarf",
        description: "Stunted, hardy folk adapted to toxins.",
        ability: { name: "Iron Gut", description: "Immune to Poison", code: "AddStatus(Source, 'IMMUNE_POISON', 99)" }
      }
    ],
    classes: [
      {
        name: "Scrapper",
        description: "Melee specialist using junk.",
        ability: { name: "Wrench Bash", description: "High Dmg", code: "Damage(Target, 10, 'KINETIC')" }
      }
    ],
    origins: [
      {
        name: "Escaped Test Subject",
        description: "Fleeing the bio-labs.",
        ability: { name: "Adrenaline", description: "Speed Boost", code: "ModStat(Source, 'SPEED', 5)" }
      }
    ]
  },
  atlas: [
    { id: "hub", name: "The Neon-Hub", biome: "HUB", difficulty: 0, connections: ["platformer_1"] },
    { id: "platformer_1", name: "Upper Platformer", biome: "SHAFT", difficulty: 1, connections: ["roguelike"] },
    { id: "roguelike", name: "Roguelike Crossroads", biome: "SEWER", difficulty: 2, connections: ["platformer_2", "platformer_1_lower"] },
    { id: "platformer_2", name: "Platformer 2 (2 exits)", biome: "SHAFT", difficulty: 3, connections: ["hub"] },
    { id: "platformer_1_lower", name: "Platformer 1 Lower", biome: "SHAFT", difficulty: 2, connections: ["hub"] }
  ],
  levels: {
      "hub": HUB_LEVEL,
      "platformer_1": PLATFORMER_1,
      "roguelike": ROGUELIKE_LEVEL,
      "platformer_2": PLATFORMER_2,
      "platformer_1_lower": PLATFORMER_1_LOWER
  },
  active_level: HUB_LEVEL
};
