
import React, { useState, useEffect } from 'react';
import { webLLMService } from '../services/WebLLMService';
import { generatorService } from '../services/GeneratorService';

interface AIConfigPanelProps {
    onReady: (isReady: boolean) => void;
}

export const AIConfigPanel: React.FC<AIConfigPanelProps> = ({ onReady }) => {
    const [provider, setProvider] = useState<'gemini' | 'webllm'>('gemini');
    const [isWebGPU, setIsWebGPU] = useState<boolean | null>(null);
    const [models, setModels] = useState<{id: string, name: string}[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [progress, setProgress] = useState<string>('');
    const [storage, setStorage] = useState<{usage: number, quota: number, percent: number} | null>(null);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const checkGPU = async () => {
            const supported = await webLLMService.isWebGPUSupported();
            setIsWebGPU(supported);
            if (supported) {
                setModels(webLLMService.getAvailableModels());
            }
        };
        checkGPU();
        updateStorage();
    }, []);

    useEffect(() => {
        generatorService.setProvider(provider);
        if (provider === 'gemini') {
            onReady(true);
        } else {
            onReady(isLoaded);
        }
    }, [provider, isLoaded, onReady]);

    const updateStorage = async () => {
        const est = await webLLMService.getStorageEstimate();
        setStorage(est);
    };

    const handleInitialize = async () => {
        if (!selectedModel) return;
        setIsInitializing(true);
        try {
            await webLLMService.initialize(selectedModel, (report) => {
                setProgress(report.text);
            });
            setIsLoaded(true);
            updateStorage();
        } catch (e) {
            console.error(e);
            setProgress(`Error: ${e}`);
        } finally {
            setIsInitializing(false);
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
            padding: '15px',
            marginTop: '20px',
            width: '400px',
            textAlign: 'left',
            fontFamily: 'monospace',
            fontSize: '0.9em'
        }}>
            <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #333', paddingBottom: '5px' }}>AI ENGINE CONFIGURATION</h3>

            <div style={{ marginBottom: '10px' }}>
                <label style={{ marginRight: '15px' }}>
                    <input
                        type="radio"
                        name="provider"
                        value="gemini"
                        checked={provider === 'gemini'}
                        onChange={() => setProvider('gemini')}
                    /> GEMINI (Cloud)
                </label>
                <label>
                    <input
                        type="radio"
                        name="provider"
                        value="webllm"
                        checked={provider === 'webllm'}
                        onChange={() => setProvider('webllm')}
                    /> WEBLLM (Local)
                </label>
            </div>

            {provider === 'webllm' && (
                <div style={{ borderTop: '1px solid #222', paddingTop: '10px' }}>
                    <div style={{ marginBottom: '10px', color: isWebGPU ? '#0f0' : '#f00' }}>
                        WebGPU Support: {isWebGPU === null ? 'Checking...' : (isWebGPU ? 'YES' : 'NO (Required for Local AI)')}
                    </div>

                    {isWebGPU && (
                        <>
                            <div style={{ marginBottom: '10px' }}>
                                <label>Model: </label>
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    style={{ background: '#000', color: '#0f0', border: '1px solid #0f0', padding: '2px', width: '250px' }}
                                    disabled={isInitializing}
                                >
                                    <option value="">-- Select Model --</option>
                                    {models.map(m => (
                                        <option key={m.id} value={m.id}>{m.id}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleInitialize}
                                disabled={!selectedModel || isInitializing}
                                style={{
                                    background: isLoaded ? '#050' : '#0f0',
                                    color: '#000',
                                    border: 'none',
                                    padding: '5px 10px',
                                    cursor: 'pointer',
                                    width: '100%',
                                    fontWeight: 'bold'
                                }}
                            >
                                {isLoaded ? 'MODEL LOADED (READY)' : (isInitializing ? 'INITIALIZING...' : 'DOWNLOAD & INITIALIZE')}
                            </button>

                            {progress && (
                                <div style={{
                                    marginTop: '10px',
                                    fontSize: '0.8em',
                                    color: '#aaa',
                                    maxHeight: '60px',
                                    overflowY: 'auto',
                                    padding: '5px',
                                    background: '#111'
                                }}>
                                    {progress}
                                </div>
                            )}

                            {storage && (
                                <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#666' }}>
                                    Cache Usage: {formatBytes(storage.usage)} / {formatBytes(storage.quota)} ({storage.percent.toFixed(1)}%)
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {provider === 'gemini' && (
                <div style={{ color: '#666', fontSize: '0.8em' }}>
                    Using remote Google Gemini API. Requires VITE_GEMINI_API_KEY.
                </div>
            )}
        </div>
    );
};
