
import React from 'react';

interface EntityStats {
    id: number;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    state: number;
}

interface EntityInspectorProps {
    inspectStats: EntityStats;
    onClose: () => void;
}

export const EntityInspector: React.FC<EntityInspectorProps> = ({ inspectStats, onClose }) => {
    return (
        <div style={{
            position: "absolute",
            top: "10px",
            right: "-220px",
            width: "200px",
            background: "rgba(0, 20, 0, 0.9)",
            border: "1px solid #0f0",
            padding: "10px",
            fontFamily: "monospace",
            fontSize: "0.8em",
            zIndex: 20
        }}>
            <div style={{ borderBottom: "1px solid #333", marginBottom: "5px", color: "#fff" }}>ENTITY INSPECTOR</div>
            <div>ID: <span style={{ color: "cyan" }}>{inspectStats.id}</span></div>
            <div>LOC: {inspectStats.x}, {inspectStats.y}</div>
            <div style={{ marginTop: "5px", color: "#aaa" }}>STATS</div>
            <div>HP: <span style={{ color: inspectStats.hp < 10 ? "red" : "#0f0" }}>{inspectStats.hp}</span> / {inspectStats.maxHp}</div>
            <div>ATK: {inspectStats.atk}</div>
            <div>DEF: {inspectStats.def}</div>
            <div>STATE: {inspectStats.state === 1 ? "DEAD" : "ALIVE"}</div>
            <button
                onClick={onClose}
                style={{
                    marginTop: "10px",
                    width: "100%",
                    background: "#222",
                    color: "#fff",
                    border: "1px solid #555",
                    cursor: "pointer"
                }}
            >
                CLOSE
            </button>
        </div>
    );
};
