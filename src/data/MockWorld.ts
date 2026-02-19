
import { WorldData, LevelData } from "../services/GeneratorService";

const HUB_LEVEL: LevelData = {
    id: "hub",
    name: "The Neon-Hub",
    description: "A safe zone with portals to other sectors.",
    map_layout: [
      "########################################",
      "#@.....................................#",
      "#......................................#",
      "#.........[P]..........................#",
      "#........PLATFORM......................#",
      "#......................................#",
      "#......................................#",
      "#......................................#",
      "#......................................#",
      "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Polished Floor", type: "FLOOR", color: 0x222222, passable: true, description: "Clean and safe." },
      { symbol: "#", name: "Hub Wall", type: "WALL", color: 0x444444, passable: false, description: "Reinforced steel." },
      { symbol: "P", name: "Platformer Portal", type: "GATE", color: 0xFF00FF, passable: true, description: "To the 1st Platformer." },
      { symbol: "[", name: "Bracket", type: "WALL", color: 0x555555, passable: false, description: "Decor." },
      { symbol: "]", name: "Bracket", type: "WALL", color: 0x555555, passable: false, description: "Decor." }
    ],
    entities: [],
    entity_roster: [],
    platformer_config: { gravity: 0.5, jump_force: -1.2, wall_color: 0x444444 }
};

const PLATFORMER_1: LevelData = {
    id: "platformer_1",
    name: "1st Platformer",
    description: "The first vertical descent.",
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
      { symbol: ">", name: "Exit", type: "GATE", color: 0x00FF00, passable: true, description: "To the Roguelike Mid-Level." },
      { symbol: "X", name: "Exit Area", type: "FLOOR", color: 0x004400, passable: true, description: "Safe to exit here." }
    ],
    entities: [],
    entity_roster: [],
    platformer_config: { gravity: 0.6, jump_force: -1.5, wall_color: 0xAAAAAA }
};

const ROGUELIKE_LEVEL: LevelData = {
    id: "roguelike",
    name: "Roguelike Mid-Level",
    description: "A crossroads in the deep.",
    map_layout: [
      "########################################",
      "#......................................#",
      "#>....................................>#",
      "#>@...................................>#",
      "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Concrete", type: "FLOOR", color: 0x444444, passable: true, description: "Wet floor." },
      { symbol: "#", name: "Rusted Wall", type: "WALL", color: 0x885555, passable: false, description: "Iron and rust." },
      { symbol: ">", name: "Exit", type: "GATE", color: 0x00FF00, passable: true, description: "Next level." }
    ],
    entities: [],
    entity_roster: [],
    platformer_config: { gravity: 0.5, jump_force: -1.2, wall_color: 0x885555 }
};

const PLATFORMER_2: LevelData = {
    id: "platformer_2",
    name: "2nd Platformer",
    description: "The path to the core.",
    map_layout: [
      "########################################",
      "#@.....................................#",
      "#######................................#",
      "#......................................#",
      "#............#######.................XX#",
      "#....................................>>#",
      "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Air", type: "FLOOR", color: 0x111111, passable: true, description: "Empty space." },
      { symbol: "#", name: "Platform", type: "WALL", color: 0xAAAAAA, passable: false, description: "Steel platform." },
      { symbol: ">", name: "Exit", type: "GATE", color: 0x00FF00, passable: true, description: "To the Main Dungeon." },
      { symbol: "X", name: "Exit Area", type: "FLOOR", color: 0x004400, passable: true, description: "Safe to exit here." }
    ],
    entities: [],
    entity_roster: [],
    platformer_config: { gravity: 0.6, jump_force: -1.5, wall_color: 0xAAAAAA }
};

const PLATFORMER_3: LevelData = {
    id: "platformer_3",
    name: "Return Path",
    description: "A path back to safety.",
    map_layout: [
      "########################################",
      "#@...................................XX#",
      "#######..............................>>#",
      "#............#######...................#",
      "#......................................#",
      "#....................................XX#",
      "#....................................>>#",
      "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Air", type: "FLOOR", color: 0x111111, passable: true, description: "Empty space." },
      { symbol: "#", name: "Platform", type: "WALL", color: 0xAAAAAA, passable: false, description: "Steel platform." },
      { symbol: ">", name: "Exit", type: "GATE", color: 0x00FF00, passable: true, description: "Back to Hub." },
      { symbol: "X", name: "Exit Area", type: "FLOOR", color: 0x004400, passable: true, description: "Safe to exit here." }
    ],
    entities: [],
    entity_roster: [],
    platformer_config: { gravity: 0.6, jump_force: -1.5, wall_color: 0xAAAAAA }
};

const MAIN_DUNGEON: LevelData = {
    id: "main_dungeon",
    name: "Main Dungeon",
    description: "The final depth.",
    map_layout: [
      "########################################",
      "#@.....................................#",
      "#......................................#",
      "#...........CENTRAL CORE...............#",
      "#......................................#",
      "#......................................#",
      "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Polished Floor", type: "FLOOR", color: 0x222222, passable: true, description: "Clean and safe." },
      { symbol: "#", name: "Wall", type: "WALL", color: 0x444444, passable: false, description: "Reinforced steel." }
    ],
    entities: [],
    entity_roster: [],
    platformer_config: { gravity: 0.5, jump_force: -1.2, wall_color: 0x444444 }
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
    { id: "platformer_1", name: "1st Platformer", biome: "SHAFT", difficulty: 1, connections: ["roguelike"] },
    { id: "roguelike", name: "Roguelike Mid-Level", biome: "SEWER", difficulty: 2, connections: ["platformer_2", "platformer_3"] },
    { id: "platformer_2", name: "2nd Platformer", biome: "SHAFT", difficulty: 3, connections: ["main_dungeon"] },
    { id: "platformer_3", name: "Return Path", biome: "SHAFT", difficulty: 2, connections: ["hub"] },
    { id: "main_dungeon", name: "Main Dungeon", biome: "CORE", difficulty: 4, connections: [] }
  ],
  levels: {
      "hub": HUB_LEVEL,
      "platformer_1": PLATFORMER_1,
      "roguelike": ROGUELIKE_LEVEL,
      "platformer_2": PLATFORMER_2,
      "platformer_3": PLATFORMER_3,
      "main_dungeon": MAIN_DUNGEON
  },
  active_level: HUB_LEVEL
};
