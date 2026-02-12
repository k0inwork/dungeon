
import { GoogleGenAI } from "@google/genai";
import { MapGenerator } from "./MapGenerator";
import { MOCK_WORLD_DATA } from "../data/MockWorld";

// --- CONTEXT INJECTION (THE RULES) ---
const BATTLE_LOGIC_CONTEXT = `
RULES OF PHYSICS:
1. DAMAGE TYPES: KINETIC (Physical), THERMAL (Fire), ENTROPIC (Ice/Decay), ENERGY (Volt), BIOTIC (Poison), COGNITIVE (Psychic).
2. STATS: HP (Health), SPEED (Action Points per tick).
`;

const AETHER_SCRIPT_CONTEXT = `
AETHERSCRIPT SYNTAX (Strict Subset of JS):
- NO loops, NO arrays, NO objects.
- GLOBAL OBJECTS: 'Source' (Caster), 'Target' (Receiver).
- ACTIONS:
  * Damage(Target, amount, "TYPE")
  * Heal(Target, amount)
  * Push(Target, distance)
  * Teleport(Source, x, y)
  * Spawn("entity_id", x, y)
  * Log("Message")
  * AddStatus(Target, "STATUS_ID", duration)
`;

// --- LOGGING ---
export interface InteractionLog {
  id: number;
  timestamp: string;
  phase: string;
  prompt: string;
  response: string;
}

// --- TAXONOMY DEFINITIONS ---
export interface ScriptStruct {
  name: string;
  description: string;
  code: string; // The implementation
}

export interface TaxonomyDef {
  name: string;
  description: string;
  ability: ScriptStruct; // Structured Perk
}

// --- ATLAS DEFINITIONS ---
export interface AtlasNode {
  id: string;
  name: string;
  biome: string;
  difficulty: number;
  connections: string[]; 
}

// --- LEVEL DEFINITIONS ---
export interface EntityDef {
  id: string;
  name: string;
  x: number;
  y: number;
  taxonomy: {
    race: string;
    class: string;
    origin: string;
  };
  stats: {
    hp: number;
    speed: number;
  };
  glyph: {
    char: string;
    color: number; 
  };
  scripts: {
    passive: string;
    active: string[];
  };
}

export interface TerrainDef {
  symbol: string;
  name: string;
  type: "FLOOR" | "WALL" | "LIQUID" | "GATE" | "HAZARD";
  color: number;
  description: string;
  passable: boolean;
}

// --- MASTER ROOT OBJECT ---
export interface WorldData {
  theme: {
    name: string;
    lore: string;
  };
  taxonomy: {
    races: TaxonomyDef[];
    classes: TaxonomyDef[];
    origins: TaxonomyDef[];
  };
  atlas: AtlasNode[];
  active_level: {
    name: string;
    description: string;
    map_layout: string[]; 
    terrain_legend: TerrainDef[];
    entities: EntityDef[];
    entity_roster: EntityDef[];
    platformer_config: {
      gravity: number;
      jump_force: number;
      wall_color: number;
    };
  };
}

class GeneratorService {
  private ai: GoogleGenAI;
  public history: InteractionLog[] = [];
  private logIdCounter = 0;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  }

  private log(phase: string, prompt: string, response: string) {
    this.history.unshift({
      id: ++this.logIdCounter,
      timestamp: new Date().toLocaleTimeString(),
      phase,
      prompt,
      response
    });
  }

  private cleanJson(text: string): string {
    // Remove markdown code blocks if present
    return text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  }

  private cleanCode(text: string): string {
      // Remove markdown code blocks if present, generic
      return text.replace(/^```\w*\s*/, '').replace(/\s*```$/, '');
  }

  private async callAI(prompt: string, phaseName: string): Promise<any> {
    try {
      const result = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const text = result.text;
      if (!text) throw new Error("Empty response");
      
      this.log(phaseName, prompt, text);
      
      try {
        return JSON.parse(this.cleanJson(text));
      } catch (parseError) {
        console.error("JSON Parse Error", parseError);
        throw new Error("Failed to parse AI response as JSON");
      }
    } catch (e) {
      console.error(`AI Error [${phaseName}]:`, e);
      this.log(phaseName, prompt, `ERROR: ${e}`);
      throw e;
    }
  }

  async repairForthCode(code: string, error: string): Promise<string> {
      const prompt = `
Role: Forth Expert / WAForth Compiler.
Task: Fix the following Forth Kernel code which failed to compile/run.
Error: "${error}"

NOTES:
1. "word not supported in interpret mode" means a compile-only word (like IF, DO, THEN) was used outside a colon definition.
2. Ensure words like >= or 2DROP are defined if used.
3. Return ONLY the fixed Forth code. No explanations.

CODE:
${code}
`;
      try {
          const result = await this.ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
          });
          const text = result.text;
          this.log("DEBUG_REPAIR", prompt, text);
          return this.cleanCode(text);
      } catch (e) {
          console.error("AI Repair Failed", e);
          throw e;
      }
  }

  // --- MOCKED GENERATION ---
  generateMockWorld(): WorldData {
    this.log("MOCK", "INITIATING_MOCK_PROTOCOL", "LOADING_GOLDEN_SAMPLE...");
    
    // We still run the MapGenerator on the mock data to ensure the map layout is fresh/randomized
    // based on the static "Golden Sample" templates
    const mockData = JSON.parse(JSON.stringify(MOCK_WORLD_DATA)); // Deep copy
    
    // Ensure legend exists (it does in mock, but good practice)
    if (!mockData.active_level.terrain_legend) mockData.active_level.terrain_legend = [];
    
    const mapGen = new MapGenerator(40, 20, "MOCK_SEED_" + Date.now());
    const generatedMap = mapGen.generate(
      mockData.active_level.entity_roster, 
      mockData.active_level.terrain_legend
    );

    mockData.active_level.map_layout = generatedMap.layout;
    mockData.active_level.entities = generatedMap.entities;
    
    return mockData;
  }

  async generateWorld(seed: string): Promise<WorldData> {
    // 1. PHASE: THEME (LORE)
    const themeData = await this.callAI(`
      Role: World Architect.
      Task: Generate a Setting Theme based on seed: "${seed}".
      Output JSON: { "name": "Title", "lore": "2 sentences." }
    `, "PHASE 1: THEME");

    // 2. PHASE: RACES (BIOLOGY)
    const raceData = await this.callAI(`
      Context: ${JSON.stringify(themeData)}
      ${BATTLE_LOGIC_CONTEXT}
      ${AETHER_SCRIPT_CONTEXT}
      Task: Define 3 distinct Races.
      Output JSON: { 
        "races": [ 
          { 
            "name": "Name", 
            "description": "Flavor", 
            "ability": { 
               "name": "Passive Name", 
               "description": "What it does", 
               "code": "AetherScript code (e.g. Heal(Source, 1))" 
            } 
          } 
        ] 
      }
    `, "PHASE 2: RACES");

    // 3. PHASE: CLASSES (DISCIPLINE)
    const classData = await this.callAI(`
      Context: ${JSON.stringify(themeData)}
      Existing Races: ${JSON.stringify(raceData.races.map((r: any) => r.name))}
      ${BATTLE_LOGIC_CONTEXT}
      ${AETHER_SCRIPT_CONTEXT}
      Task: Define 3 Classes (Jobs) compatible with the Races.
      Output JSON: { 
        "classes": [ 
          { 
            "name": "Name", 
            "description": "Role", 
            "ability": { 
               "name": "Active Skill Name", 
               "description": "Combat effect", 
               "code": "AetherScript code (e.g. Damage(Target, 10, 'KINETIC'))" 
            } 
          } 
        ] 
      }
    `, "PHASE 3: CLASSES");

    // 4. PHASE: ORIGINS (ALLEGIANCE)
    const originData = await this.callAI(`
      Context: ${JSON.stringify(themeData)}
      Races: ${JSON.stringify(raceData.races.map((r: any) => r.name))}
      Classes: ${JSON.stringify(classData.classes.map((c: any) => c.name))}
      ${AETHER_SCRIPT_CONTEXT}
      Task: Define 3 Origins (Factions/Backgrounds).
      Output JSON: { 
        "origins": [ 
          { 
            "name": "Name", 
            "description": "Background", 
            "ability": { 
               "name": "Utility Perk", 
               "description": "Non-combat benefit", 
               "code": "AetherScript code (e.g. Log('Diplomacy check passed'))" 
            } 
          } 
        ] 
      }
    `, "PHASE 4: ORIGINS");

    // 5. PHASE: LEVEL (ASSETS)
    const fullTaxonomy = {
      races: raceData.races,
      classes: classData.classes,
      origins: originData.origins
    };

    const levelData = await this.callAI(`
      Theme: ${JSON.stringify(themeData)}
      Taxonomy: ${JSON.stringify(fullTaxonomy)}
      Task:
      1. Create an Atlas of 3 Nodes.
      2. Define the 'active_level' (First node).
      3. Create 'entity_roster' using the Taxonomy (Mix Race/Class/Origin).
      4. Define 'terrain_legend'.
      
      JSON Structure:
      {
        "atlas": [{ "id": "l1", "name": "Start", "biome": "Type", "difficulty": 1, "connections": [] }],
        "active_level": {
          "name": "Level Name",
          "description": "Flavor",
          "terrain_legend": [ { "symbol": ".", "name": "Floor", "type": "FLOOR", "color": 2236962, "passable": true, "description": "Desc" } ],
          "entity_roster": [
            {
               "id": "enemy_1", "name": "Name", "x": 0, "y": 0,
               "taxonomy": { "race": "OneFromList", "class": "OneFromList", "origin": "OneFromList" },
               "stats": { "hp": 50, "speed": 10 },
               "glyph": { "char": "e", "color": 16711680 },
               "scripts": { "passive": "Regen(1)", "active": ["Damage(Target, 5, 'KINETIC')"] }
            }
          ],
          "platformer_config": { "gravity": 0.5, "jump_force": -1.2, "wall_color": 5592405 }
        }
      }
    `, "PHASE 5: LEVEL");

    // --- FALLBACK SANITIZATION ---
    // Ensure the terrain legend has at least a Wall and a Floor, otherwise the MapGenerator will produce invisible maps.
    if (!levelData.active_level.terrain_legend) {
        levelData.active_level.terrain_legend = [];
    }
    const legend = levelData.active_level.terrain_legend;
    
    // Check for Floor
    if (!legend.find((t: any) => t.type === "FLOOR")) {
       legend.push({ symbol: ".", name: "Standard Floor", type: "FLOOR", color: 0x444444, passable: true, description: "Default ground." });
    }
    // Check for Wall
    if (!legend.find((t: any) => t.type === "WALL")) {
       legend.push({ symbol: "#", name: "Standard Wall", type: "WALL", color: 0x888888, passable: false, description: "Default barrier." });
    }

    // --- HYBRID GENERATION STEP ---
    const mapGen = new MapGenerator(40, 20, seed);
    const roster = levelData.active_level.entity_roster || [];
    const generatedMap = mapGen.generate(roster, legend);

    return {
      theme: themeData,
      taxonomy: fullTaxonomy,
      atlas: levelData.atlas,
      active_level: {
        ...levelData.active_level,
        map_layout: generatedMap.layout,
        entities: generatedMap.entities,
        entity_roster: roster
      }
    };
  }
}

export const generatorService = new GeneratorService();
