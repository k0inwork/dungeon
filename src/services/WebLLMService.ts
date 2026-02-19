
import * as webllm from "@mlc-ai/web-llm";

export interface ModelRecord {
    model_id: string;
    vram_required_MB?: number;
    description?: string;
}

export const AVAILABLE_MODELS: ModelRecord[] = [
    {
        model_id: "Llama-3.1-8B-Instruct-q4f16_1-MLC",
        vram_required_MB: 6000,
        description: "Llama 3.1 8B (Recommended)"
    },
    {
        model_id: "Phi-3-mini-4k-instruct-q4f16_1-MLC",
        vram_required_MB: 2500,
        description: "Phi-3 Mini (Fast, Low VRAM)"
    },
    {
        model_id: "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC",
        vram_required_MB: 1000,
        description: "TinyLlama (Lightweight)"
    },
    {
        model_id: "Gemma-2-2b-it-q4f16_1-MLC",
        vram_required_MB: 2000,
        description: "Gemma 2 2B"
    }
];

export class WebLLMService {
    private engine: webllm.MLCEngineInterface | null = null;
    private progressCallback?: (report: webllm.InitProgressReport) => void;
    private currentModelId: string | null = null;

    async isWebGPUSupported(): Promise<boolean> {
        return !!navigator.gpu;
    }

    async getStorageEstimate() {
        if (navigator.storage && navigator.storage.estimate) {
            return await navigator.storage.estimate();
        }
        return null;
    }

    setInitProgressCallback(cb: (report: webllm.InitProgressReport) => void) {
        this.progressCallback = cb;
    }

    async loadModel(modelId: string) {
        if (this.engine && this.currentModelId === modelId) {
            return;
        }

        if (this.engine) {
            await this.engine.unload();
        }

        // We use CreateMLCEngine for simplicity here,
        // in a production app CreateWebWorkerMLCEngine is preferred.
        this.engine = await webllm.CreateMLCEngine(modelId, {
            initProgressCallback: (report) => {
                if (this.progressCallback) this.progressCallback(report);
            }
        });
        this.currentModelId = modelId;
    }

    async generate(prompt: string, systemPrompt?: string): Promise<string> {
        if (!this.engine) throw new Error("WebLLM Model not loaded. Please select and download a model first.");

        const messages: webllm.ChatCompletionMessageParam[] = [];
        if (systemPrompt) {
            messages.push({ role: "system", content: systemPrompt });
        }
        messages.push({ role: "user", content: prompt });

        const reply = await this.engine.chat.completions.create({
            messages,
        });

        return reply.choices[0].message.content || "";
    }

    async unload() {
        if (this.engine) {
            await this.engine.unload();
            this.engine = null;
            this.currentModelId = null;
        }
    }

    getLoadedModelId() {
        return this.currentModelId;
    }
}

export const webLLMService = new WebLLMService();
