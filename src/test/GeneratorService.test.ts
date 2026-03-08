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

import { generatorService } from '../services/GeneratorService';

describe('GeneratorService Live Connection', () => {

    beforeAll(() => {
        // Set real API configuration for the ZAI provider
        // @ts-ignore
        import.meta.env.VITE_ZAI_API_KEY = 'f886907aa0f54a9c8d480755c8dceaf8.GQE52fZAgEEqiQM1';
        // @ts-ignore
        import.meta.env.VITE_ZAI_MODEL = 'glm-4.7';
    });

    // We increase timeout significantly for real LLM generation
    test('ZAI Provider successfully generates a world from live endpoint', async () => {

        // 1. Setup the service to use ZAI
        generatorService.setProvider('ZAI');
        expect(generatorService.getProviderType()).toBe('ZAI');

        console.log("Starting live generation with ZAI...");
        // 2. Execute a real world generation call to Z.AI
        // Use a simpler seed to hope for a faster generation, given the 5-step prompt pipeline.
        const worldData = await generatorService.generateWorld("Mountain");

        // 3. Assert the structure is built and returned successfully
        expect(worldData).toBeDefined();
        expect(worldData.theme.name).toBeDefined();
        expect(worldData.taxonomy.races.length).toBeGreaterThan(0);
        expect(worldData.taxonomy.classes.length).toBeGreaterThan(0);
        expect(worldData.taxonomy.origins.length).toBeGreaterThan(0);

        expect(worldData.active_level).toBeDefined();

        // Map generator should have generated a layout based on LLM taxonomy
        expect(worldData.active_level.map_layout).toBeDefined();
        expect(worldData.active_level.map_layout.length).toBeGreaterThan(0);

        console.log("Successfully received and parsed generation:", worldData.theme.name);
    }, 240000); // 4 minute timeout for live 5-step API sequence
});
