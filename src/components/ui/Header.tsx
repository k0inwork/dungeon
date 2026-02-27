import React from "react";

interface HeaderProps {
    mode: string;
    viewMode: "GAME" | "ARCHITECT";
    setViewMode: (mode: "GAME" | "ARCHITECT") => void;
    onSave: () => void;
}

export const Header: React.FC<HeaderProps> = ({ mode, viewMode, setViewMode, onSave }) => {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #0f0', zIndex: 30, background: '#000' }}>
            <div style={{ fontWeight: 'bold' }}>AI ROGUELIKE v2.2 [MODULAR]</div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    onClick={onSave}
                    style={{ background: '#000', color: '#0f0', border: '1px solid #0f0', padding: '2px 10px', cursor: 'pointer' }}
                >
                    SAVE
                </button>
                <button
                    onClick={() => setViewMode("GAME")}
                    style={{ background: viewMode === "GAME" ? "#0f0" : "#000", color: viewMode === "GAME" ? "#000" : "#0f0", border: "1px solid #0f0", cursor: "pointer" }}
                >
                    SIMULATION
                </button>
                <button
                    onClick={() => setViewMode("ARCHITECT")}
                    style={{ background: viewMode === "ARCHITECT" ? "#f0f" : "#000", color: viewMode === "ARCHITECT" ? "#000" : "#f0f", border: "1px solid #f0f", cursor: "pointer" }}
                >
                    ARCHITECT
                </button>
            </div>
            <div style={{ color: '#0f0', fontSize: '0.8em' }}>STATUS: {mode}</div>
        </div>
    );
};
