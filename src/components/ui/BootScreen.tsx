import React from "react";
import { AIConfig } from "../AIConfig";
import { GenerationProgress } from "../../services/ArchitectService";

interface BootScreenProps {
    seed: string;
    setSeed: (seed: string) => void;
    saveExists: boolean;
    onGenerate: (e: React.MouseEvent) => void;
    onLoad: () => void;
    progress?: GenerationProgress | null;
}

export const BootScreen: React.FC<BootScreenProps> = ({ seed, setSeed, saveExists, onGenerate, onLoad, progress }) => {
    if (progress) {
        return (
            <div style={{ textAlign: "center", color: "#0f0", width: "600px", margin: "0 auto" }}>
                <h1 style={{ animation: "pulse 2s infinite" }}>{progress.phase}</h1>
                <p style={{ fontSize: "1.2em", margin: "20px 0" }}>{progress.detail}</p>

                <div style={{ width: "100%", height: "20px", background: "#333", border: "1px solid #0f0" }}>
                    <div style={{ width: `${progress.progress}%`, height: "100%", background: "#0f0", transition: "width 0.5s ease" }} />
                </div>

                {progress.errors && progress.errors.length > 0 && (
                    <div style={{ marginTop: "20px", color: "red", textAlign: "left", border: "1px solid red", padding: "10px" }}>
                        <h3>ERRORS DETECTED:</h3>
                        <ul>
                            {progress.errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ textAlign: "center" }}>
            <h1>WORLD SEED INPUT</h1>
            <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                style={{ background: "#000", border: "1px solid #0f0", color: "#0f0", padding: "10px", fontSize: "1.2em", width: "300px", textAlign: "center" }}
            />
            <br /><br />
            <div style={{ color: "#666", marginBottom: "10px" }}>Tip: Shift+Click for Instant Mock World</div>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                <button
                    onClick={onGenerate}
                    style={{ background: "#0f0", color: "#000", border: "none", padding: "10px 20px", fontSize: "1.2em", cursor: "pointer" }}
                >
                    INITIATE GENERATION
                </button>
                {saveExists && (
                    <button
                        onClick={onLoad}
                        style={{ background: "#00f", color: "#fff", border: "none", padding: "10px 20px", fontSize: "1.2em", cursor: "pointer" }}
                    >
                        LOAD LAST SESSION
                    </button>
                )}
            </div>
            <AIConfig />
        </div>
    );
};
