
import React, { useState, useEffect } from 'react';
import { webLLMService, AVAILABLE_MODELS } from '../services/WebLLMService';
import { generatorService, AIProviderType } from '../services/GeneratorService';

export const AIConfig: React.FC = () => {
    const [provider, setProvider] = useState<AIProviderType>(generatorService.getProviderType());
    const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);
    const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].model_id);
    const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [storageInfo, setStorageInfo] = useState<{usage: number, quota: number} | null>(null);
    const [loadedModel, setLoadedModel] = useState<string | null>(webLLMService.getLoadedModelId());

    useEffect(() => {
        webLLMService.isWebGPUSupported().then(setWebGPUSupported);
        refreshStorageInfo();

        webLLMService.setInitProgressCallback((report) => {
            setDownloadProgress(report.text);
        });
    }, []);

    const refreshStorageInfo = async () => {
        const info = await webLLMService.getStorageEstimate();
        if (info) {
            setStorageInfo({
                usage: info.usage || 0,
                quota: info.quota || 0
            });
        }
    };

    const handleProviderChange = (newProvider: AIProviderType) => {
        setProvider(newProvider);
        generatorService.setProvider(newProvider);
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            await webLLMService.loadModel(selectedModel);
            setLoadedModel(selectedModel);
            refreshStorageInfo();
        } catch (e) {
            console.error("Download failed", e);
            setDownloadProgress("Error: " + (e as Error).message);
        } finally {
            setIsDownloading(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div style={{
            background: '#000',
            border: '1px solid #333',
            padding: '20px',
            marginTop: '20px',
            maxWidth: '500px',
            margin: '20px auto',
            textAlign: 'left',
            fontFamily: 'monospace'
        }}>
            <h3 style={{ color: '#0f0', borderBottom: '1px solid #333', paddingBottom: '5px', marginTop: 0 }}>AI GENERATOR CONFIG</h3>

            <div style={{ marginBottom: '15px' }}>
                <div style={{ color: '#888', marginBottom: '5px' }}>PROVIDER:</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => handleProviderChange('GEMINI')}
                        style={{
                            flex: 1,
                            padding: '8px',
                            background: provider === 'GEMINI' ? '#0f0' : '#111',
                            color: provider === 'GEMINI' ? '#000' : '#0f0',
                            border: '1px solid #0f0',
                            cursor: 'pointer'
                        }}
                    >
                        GOOGLE GEMINI
                    </button>
                    <button
                        onClick={() => handleProviderChange('WEBLLM')}
                        disabled={webGPUSupported === false}
                        style={{
                            flex: 1,
                            padding: '8px',
                            background: provider === 'WEBLLM' ? '#f0f' : '#111',
                            color: provider === 'WEBLLM' ? '#000' : '#f0f',
                            border: '1px solid #f0f',
                            cursor: 'pointer',
                            opacity: webGPUSupported === false ? 0.5 : 1
                        }}
                    >
                        LOCAL WEBLLM
                    </button>
                </div>
                {webGPUSupported === false && (
                    <div style={{ color: 'red', fontSize: '0.8em', marginTop: '5px' }}>
                        WebGPU NOT SUPPORTED in this browser. Local AI unavailable.
                    </div>
                )}
            </div>

            {provider === 'WEBLLM' && (
                <div style={{ borderTop: '1px solid #222', paddingTop: '15px' }}>
                    <div style={{ color: '#888', marginBottom: '5px' }}>LOCAL MODEL:</div>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        style={{
                            width: '100%',
                            background: '#000',
                            color: '#fff',
                            border: '1px solid #555',
                            padding: '8px',
                            marginBottom: '10px'
                        }}
                    >
                        {AVAILABLE_MODELS.map(m => (
                            <option key={m.model_id} value={m.model_id}>
                                {m.description} ({m.vram_required_MB}MB VRAM)
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={handleDownload}
                        disabled={isDownloading || loadedModel === selectedModel}
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: loadedModel === selectedModel ? '#333' : '#f0f',
                            color: '#fff',
                            border: 'none',
                            cursor: loadedModel === selectedModel ? 'default' : 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {isDownloading ? 'DOWNLOADING...' : (loadedModel === selectedModel ? 'MODEL LOADED' : 'DOWNLOAD & LOAD MODEL')}
                    </button>

                    {downloadProgress && (
                        <div style={{
                            marginTop: '10px',
                            fontSize: '0.75em',
                            color: '#aaa',
                            maxHeight: '60px',
                            overflow: 'auto',
                            background: '#0a0a0a',
                            padding: '5px',
                            border: '1px solid #222'
                        }}>
                            {downloadProgress}
                        </div>
                    )}

                    {storageInfo && (
                        <div style={{ marginTop: '15px', fontSize: '0.8em', color: '#666' }}>
                            CACHE USAGE: {formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota)}
                        </div>
                    )}
                </div>
            )}

            {provider === 'GEMINI' && (
                <div style={{ color: '#666', fontSize: '0.9em' }}>
                    Using Google Gemini Flash 1.5. Requires VITE_GEMINI_API_KEY.
                </div>
            )}
        </div>
    );
};
