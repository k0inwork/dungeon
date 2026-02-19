
import { CreateMLCEngine, prebuiltAppConfig, MLCEngineInterface, InitProgressReport } from "@mlc-ai/web-llm";

export class WebLLMService {
    private engine: MLCEngineInterface | null = null;
    private currentModelId: string | null = null;

    /**
     * Checks if WebGPU is supported by the current browser environment.
     */
    public async isWebGPUSupported(): Promise<boolean> {
        if (typeof navigator === 'undefined' || !navigator.gpu) {
            return false;
        }
        try {
            const adapter = await navigator.gpu.requestAdapter();
            return !!adapter;
        } catch (e) {
            return false;
        }
    }

    /**
     * Returns a list of prebuilt models available in WebLLM.
     */
    public getAvailableModels() {
        return prebuiltAppConfig.model_list.map(m => ({
            id: m.model_id,
            name: m.model_id
        }));
    }

    /**
     * Initializes the WebLLM engine with the specified model.
     * Downloads the model if not already cached.
     */
    public async initialize(modelId: string, onProgress?: (report: InitProgressReport) => void) {
        if (this.engine && this.currentModelId === modelId) {
            return;
        }

        this.currentModelId = modelId;
        this.engine = await CreateMLCEngine(modelId, {
            initProgressCallback: onProgress,
        });
    }

    /**
     * Generates a response for the given prompt using the local model.
     */
    public async generate(prompt: string): Promise<string> {
        if (!this.engine) {
            throw new Error("WebLLM Engine not initialized. Please select and download a model first.");
        }

        const reply = await this.engine.chat.completions.create({
            messages: [
                { role: "user", content: prompt }
            ],
        });

        return reply.choices[0].message.content || "";
    }

    /**
     * Gets an estimate of the storage usage and quota for the current origin.
     */
    public async getStorageEstimate() {
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage || 0,
                quota: estimate.quota || 0,
                percent: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0
            };
        }
        return null;
    }
}

export const webLLMService = new WebLLMService();
