import React from "react";
import { AIConfig } from "../AIConfig";

interface BootScreenProps {
    seed: string;
    setSeed: (seed: string) => void;
    saveExists: boolean;
    onGenerate: (e: React.MouseEvent) => void;
    onLoad: () => void;
}

export const BootScreen: React.FC<BootScreenProps> = ({ seed, setSeed, saveExists, onGenerate, onLoad }) => {
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
