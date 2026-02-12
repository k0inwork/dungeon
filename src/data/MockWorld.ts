
import { WorldData } from "../services/GeneratorService";

export const MOCK_WORLD_DATA: WorldData = {
  theme: {
    name: "Neon-Rot Undercity",
    lore: "Beneath the gilded spires of Aethelgard lies the Neon-Rot, a flooded sewer system where bioluminescent fungi battle with leaking cyber-fluid."
  },
  taxonomy: {
    races: [
      {
        name: "Sewer-Dwarf",
        description: "Stunted, hardy folk adapted to toxins.",
        ability: { name: "Iron Gut", description: "Immune to Poison", code: "AddStatus(Source, 'IMMUNE_POISON', 99)" }
      },
      {
        name: "Synth-Rat",
        description: "Cybernetically enhanced vermin.",
        ability: { name: "Night Vision", description: "See in dark", code: "ModStat(Source, 'VISIBILITY', 10)" }
      },
      {
        name: "Chromeblood",
        description: "Humans with quicksilver-nanites replacing their plasma. Highly adaptable.",
        ability: { name: "Overclock", description: "Temporary Speed Boost", code: "ModStat(Source, 'SPEED', 50)" }
      },
      {
        name: "Myco-Sapiens",
        description: "Sentient fungal colonies in humanoid form. Regenerative but flammable.",
        ability: { name: "Spore Cloud", description: "AoE Poison", code: "Spawn('hazard_spore_cloud', Source.X, Source.Y)" }
      }
    ],
    classes: [
      {
        name: "Scrapper",
        description: "Melee specialist using junk.",
        ability: { name: "Wrench Bash", description: "High Dmg", code: "Damage(Target, 10, 'KINETIC')" }
      },
      {
        name: "Neon-Ronin",
        description: "A disciplined blade-master of the concrete jungle.",
        ability: { name: "Flash Step", description: "Teleport Attack", code: "Teleport(Source, Target.X, Target.Y); Damage(Target, 25, 'KINETIC')" }
      },
      {
        name: "Volt-Weaver",
        description: "Hacks reality and circuits alike.",
        ability: { name: "Chain Lightning", description: "Multi-target Shock", code: "Chain(15, 3, 'ENERGY')" }
      }
    ],
    origins: [
      {
        name: "Escaped Test Subject",
        description: "Fleeing the bio-labs.",
        ability: { name: "Adrenaline", description: "Speed Boost", code: "ModStat(Source, 'SPEED', 5)" }
      },
      {
        name: "Disgraced Corp-Sec",
        description: "Former elite security, stripped of rank.",
        ability: { name: "Tactical Visor", description: "Show Enemy Stats", code: "Log(Target.Stats)" }
      },
      {
        name: "Grid-Drifter",
        description: "A wanderer of the digital and physical wastes.",
        ability: { name: "Scavenger's Luck", description: "Find more loot", code: "ModStat(Source, 'LUCK', 10)" }
      }
    ]
  },
  atlas: [
    { id: "node_1", name: "Drainage Sector 7", biome: "SEWER", difficulty: 1, connections: [] }
  ],
  active_level: {
    name: "Sector 7 Drainage",
    description: "A narrow corridor of sludge.",
    map_layout: [
      "########################################",
      "#@.............#...........~...........#",
      "#.###.##########.#########.~.#########.#",
      "#.#...#........#.#.......#.~.#.......#.#",
      "#.#.#.#.######.#.#.#####.#.~.#.#####.#.#",
      "#.#.#.#.#....#.#.#.#...#.#.~.#.#...#.#.#",
      "#...#...#....#...#.#...#...~...#...#...#",
      "#########....#####.#####.#######...#####",
      "#...................R..................#",
      "#.####.####.####.####.####.####.####.#.#",
      "#.#..#.#..#.#..#.#..#.#..#.#..#.#..#.#.#",
      "#.#..#.#..#.#..#.#..#.#..#.#..#.#..#.#.#",
      "#..................e...................#",
      "######################################.#",
      "#....................................#.#",
      "#.##################################.#.#",
      "#.#..................................#.#",
      "#.#.##################################.#",
      "#......................................#",
      "########################################"
    ],
    terrain_legend: [
      { symbol: ".", name: "Concrete", type: "FLOOR", color: 0x444444, passable: true, description: "Wet floor." },
      { symbol: "#", name: "Rusted Wall", type: "WALL", color: 0x885555, passable: false, description: "Iron and rust." },
      { symbol: "~", name: "Sludge", type: "LIQUID", color: 0x00FF00, passable: true, description: "Toxic waste." },
      { symbol: "e", name: "Mutant Rat", type: "FLOOR", color: 0xFF0000, passable: true, description: "A hostile entity." },
      { symbol: "R", name: "Giant Rat", type: "FLOOR", color: 0xFF5500, passable: true, description: "A HUGE hostile entity." }
    ],
    entities: [], // Populated by MapGenerator
    entity_roster: [
      {
        id: "mutant_rat",
        name: "Mutant Rat",
        x: 0, y: 0,
        taxonomy: { race: "Synth-Rat", class: "Scrapper", origin: "Test Subject" },
        stats: { hp: 20, speed: 12 },
        glyph: { char: "e", color: 0xFF0000 },
        scripts: { passive: "ai_passive", active: [] }
      },
      {
        id: "giant_rat",
        name: "Giant Rat",
        x: 0, y: 0,
        taxonomy: { race: "Synth-Rat", class: "Bruiser", origin: "Test Subject" },
        stats: { hp: 50, speed: 8 },
        glyph: { char: "R", color: 0xFF5500 },
        scripts: { passive: "ai_aggressive", active: [] }
      }
    ],
    platformer_config: {
      gravity: 0.6,
      jump_force: -1.5,
      wall_color: 0x885555
    }
  }
};
