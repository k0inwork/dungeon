import { expect, test, describe, beforeAll, vi } from 'vitest';

vi.mock('../services/WebLLMService', () => {
    return {
        webLLMService: {
            generate: vi.fn(),
            isWebGPUSupported: vi.fn().mockResolvedValue(false),
            getLoadedModelId: vi.fn().mockReturnValue(null),
            setInitProgressCallback: vi.fn(),
            getStorageEstimate: vi.fn().mockResolvedValue(null),
            loadModel: vi.fn()
        },
        AVAILABLE_MODELS: []
    }
});

import { generatorService, AIProviderType } from '../services/GeneratorService';
import OpenAI from "openai";

// Mock the OpenAI library so we don't actually hit the live API during unit tests
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockImplementation(async (args) => {
            // Check the prompt phase and return mock JSON to satisfy the multi-step generateWorld pipeline
            const content = args.messages[args.messages.length - 1].content;

            if (content.includes('Setting Theme based on seed')) {
              return { choices: [{ message: { content: JSON.stringify({ name: "Cyberpunk Mock", lore: "Mock lore." }) } }] };
            } else if (content.includes('Define 3 distinct Races')) {
              return { choices: [{ message: { content: JSON.stringify({ races: [{ name: "Human", description: "Boring", ability: { name: "A", description: "B", code: "Log('C')" } }] }) } }] };
            } else if (content.includes('Define 3 Classes')) {
              return { choices: [{ message: { content: JSON.stringify({ classes: [{ name: "Warrior", description: "Fights", ability: { name: "A", description: "B", code: "Damage(Target, 10, 'KINETIC')" } }] }) } }] };
            } else if (content.includes('Define 3 Origins')) {
              return { choices: [{ message: { content: JSON.stringify({ origins: [{ name: "City", description: "Urbane", ability: { name: "A", description: "B", code: "Log('City')" } }] }) } }] };
            } else if (content.includes('Create an Atlas of 3 Nodes')) {
              return { choices: [{ message: { content: JSON.stringify({
                atlas: [{ id: "l1", name: "Start", biome: "City", difficulty: 1, connections: [] }],
                active_level: {
                  name: "Level 1",
                  description: "Dark",
                  terrain_legend: [{ symbol: ".", name: "Floor", type: "FLOOR", color: 0, passable: true, description: "Floor" }, { symbol: "#", name: "Wall", type: "WALL", color: 0, passable: false, description: "Wall" }],
                  entity_roster: [],
                  platformer_config: { gravity: 0.5, jump_force: -1.2, wall_color: 0 }
                }
              }) } }] };
            }
            return { choices: [{ message: { content: "{}" } }] };
          })
        }
      };
      constructor() {}
    }
  };
});

describe('GeneratorService Integration', () => {

    beforeAll(() => {
        // Mock environment variables that Vite normally injects
        // @ts-ignore
        import.meta.env.VITE_ZAI_API_KEY = 'test_key';
        // @ts-ignore
        import.meta.env.VITE_ZAI_MODEL = 'test_model';
    });

    test('ZAI Provider loads and generates world successfully', async () => {

        // 1. Setup the service to use ZAI
        generatorService.setProvider('ZAI');
        expect(generatorService.getProviderType()).toBe('ZAI');

        // 2. Execute a world generation call
        // The mock OpenAI will intercept the internal `.generate()` calls.
        const worldData = await generatorService.generateWorld("Cyberpunk Sewers");

        // 3. Assert the structure is built and returned
        expect(worldData).toBeDefined();
        expect(worldData.theme.name).toBe("Cyberpunk Mock");
        expect(worldData.taxonomy.races.length).toBeGreaterThan(0);
        expect(worldData.taxonomy.classes.length).toBeGreaterThan(0);
        expect(worldData.taxonomy.origins.length).toBeGreaterThan(0);

        expect(worldData.active_level).toBeDefined();
        expect(worldData.active_level.name).toBe("Level 1");

        // Map generator should have generated a layout
        expect(worldData.active_level.map_layout).toBeDefined();
        expect(worldData.active_level.map_layout.length).toBe(20); // 20 rows by default
    });
});
