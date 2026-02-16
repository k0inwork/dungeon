
import { WorldData, LevelData } from "../services/GeneratorService";

const HUB_LEVEL: LevelData = {
    id: "hub",
    name: "The Neon-Hub",
    description: "A safe zone with portals to other sectors.",
    simulation_mode: "GRID",
    is_safe_zone: true,
    map_layout: [
      "########################################",
      "#@.....................................#",
      "#......................................#",
      "#.........[R]............[P]...........#",
      "#........ROGUE........PLATFORM.........#",
      "#......................................#",
      "#......................................#",
      "#......................................#",
      "#......................................#",
      "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Polished Floor", type: "FLOOR", color: 0x222222, passable: true, description: "Clean and safe." },
      { symbol: "#", name: "Hub Wall", type: "WALL", color: 0x444444, passable: false, description: "Reinforced steel." },
      { symbol: "R", name: "Roguelike Portal", type: "GATE", color: 0x00FFFF, passable: true, description: "To the Deep Sewers.", target_id: "rogue_dungeon" },
      { symbol: "P", name: "Platformer Portal", type: "GATE", color: 0xFF00FF, passable: true, description: "To the Vertical Shaft.", target_id: "platform_dungeon" },
      { symbol: "[", name: "Bracket", type: "WALL", color: 0x555555, passable: true, description: "Decor." },
      { symbol: "]", name: "Bracket", type: "WALL", color: 0x555555, passable: true, description: "Decor." }
    ],
    entities: [],
    entity_roster: [],
    platformer_config: { gravity: 0.5, jump_force: -1.2, wall_color: 0x444444 }
};

const ROGUE_LEVEL: LevelData = {
    id: "rogue_dungeon",
    name: "The Deep Sewers",
    description: "A dangerous, monster-infested maze.",
    simulation_mode: "GRID",
    is_safe_zone: false,
    force_regeneration: true,
    map_layout: [], // To be generated
    terrain_legend: [
      { symbol: ".", name: "Concrete", type: "FLOOR", color: 0x444444, passable: true, description: "Wet floor." },
      { symbol: "#", name: "Rusted Wall", type: "WALL", color: 0x885555, passable: false, description: "Iron and rust." },
      { symbol: "~", name: "Sludge", type: "LIQUID", color: 0x00FF00, passable: true, description: "Toxic waste." },
      { symbol: "H", name: "Hub Portal", type: "GATE", color: 0x00FFFF, passable: true, description: "Back to safety.", target_id: "hub" }
    ],
    entities: [],
    entity_roster: [
      {
        id: "mutant_rat",
        name: "Aggressive Rat",
        x: 0, y: 0,
        taxonomy: { race: "Synth-Rat", class: "Scrapper", origin: "Test Subject" },
        stats: { hp: 20, speed: 12 },
        glyph: { char: "R", color: 0xFF5555 },
        ai_type: 2,
        scripts: { passive: "aggressive", active: [] }
      }
    ],
    platformer_config: { gravity: 0.5, jump_force: -1.2, wall_color: 0x885555 }
};

const PLATFORM_LEVEL: LevelData = {
    id: "platform_dungeon",
    name: "The Vertical Shaft",
    description: "A series of dangerous jumps.",
    simulation_mode: "PLATFORM",
    is_safe_zone: false,
    map_layout: [
        "########################################",
        "#@.....................................#",
        "#......................................#",
        "#......................................#",
        "#......................................#",
        "#......................................#",
        "#......................................#",
        "#......................................#",
        "#......................................#",
        "####################################...#",
        "#......................................#",
        "#......................................#",
        "#......................................#",
        "#......................................#",
        "#......................................#",
        "#......................................#",
        "#......................................#",
        "#......................................#",
        "#E.....................................#",
        "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Air", type: "FLOOR", color: 0x111111, passable: true, description: "Empty space." },
      { symbol: "#", name: "Grated Platform", type: "WALL", color: 0xAAAAAA, passable: false, description: "Solid metal." },
      { symbol: "E", name: "Exit", type: "GATE", color: 0xFFFF00, passable: true, description: "To the next sector.", target_id: "platform_dungeon_2" },
      { symbol: "H", name: "Exit to Hub", type: "GATE", color: 0x00FFFF, passable: true, description: "Back to safety.", target_id: "hub" }
    ],
    entities: [],
    entity_roster: [],
    platformer_config: {
      gravity: 0.6,
      jump_force: -1.5,
      wall_color: 0xAAAAAA
    }
};

const PLATFORM_LEVEL_2: LevelData = {
    id: "platform_dungeon_2",
    name: "The High Spire",
    description: "Even more dangerous jumps.",
    simulation_mode: "PLATFORM",
    is_safe_zone: false,
    map_layout: [
        "########################################",
        "#@.....................................#",
        "#......................................#",
        "#######................................#",
        "#......................................#",
        "#......................................#",
        "#...........#######....................#",
        "#......................................#",
        "#......................................#",
        "#...........................#######....#",
        "#......................................#",
        "#......................................#",
        "#######................................#",
        "#......................................#",
        "#......................................#",
        "#...........#######....................#",
        "#......................................#",
        "#......................................#",
        "#H.....................................#",
        "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Air", type: "FLOOR", color: 0x111111, passable: true, description: "Empty space." },
      { symbol: "#", name: "Grated Platform", type: "WALL", color: 0x55AAFF, passable: false, description: "Blue steel." },
      { symbol: "H", name: "Exit to Hub", type: "GATE", color: 0xFFFF00, passable: true, description: "Back to safety.", target_id: "hub" }
    ],
    entities: [],
    entity_roster: [],
    platformer_config: {
      gravity: 0.6,
      jump_force: -1.5,
      wall_color: 0x55AAFF
    }
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
    { id: "hub", name: "The Neon-Hub", biome: "HUB", difficulty: 0, connections: ["rogue_dungeon", "platform_dungeon"] },
    { id: "rogue_dungeon", name: "The Deep Sewers", biome: "SEWER", difficulty: 1, connections: ["hub"] },
    { id: "platform_dungeon", name: "The Vertical Shaft", biome: "SHAFT", difficulty: 1, connections: ["hub", "platform_dungeon_2"] },
    { id: "platform_dungeon_2", name: "The High Spire", biome: "SHAFT", difficulty: 2, connections: ["platform_dungeon"] }
  ],
  levels: {
      "hub": HUB_LEVEL,
      "rogue_dungeon": ROGUE_LEVEL,
      "platform_dungeon": PLATFORM_LEVEL,
      "platform_dungeon_2": PLATFORM_LEVEL_2
  },
  active_level: HUB_LEVEL
};
