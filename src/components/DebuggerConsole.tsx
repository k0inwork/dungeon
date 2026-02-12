
import React, { useState } from "react";
import { ForthIDE } from "./ForthIDE";

export const DebuggerConsole: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
        <button 
            onClick={() => setIsOpen(true)}
            style={{
                background: "#000", border: "1px solid #0f0", color: "#0f0",
                fontFamily: "monospace", cursor: "pointer", zIndex: 999,
                padding: "5px 10px", boxShadow: "0 0 10px rgba(0, 255, 0, 0.2)"
            }}
        >
            {"[ >_ DEBUG ]"}
        </button>
    );
  }

  return (
    <div style={{
        position: "fixed", top: "50px", left: "50px", right: "50px", bottom: "50px",
        background: "rgba(0,0,0,0.98)", border: "2px solid #0f0",
        fontFamily: '"Courier New", monospace', color: "#0f0",
        display: "flex", flexDirection: "column",
        boxShadow: "0 0 50px rgba(0, 255, 0, 0.1)",
        zIndex: 9999
    }}>
        {/* Header */}
        <div style={{ padding: "5px 10px", background: "#111", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 'bold' }}>AETHEL_ENGINE // KERNEL_DEBUGGER_PRO</span>
            <button onClick={() => setIsOpen(false)} style={{ background: "#300", border: "1px solid #f00", color: "#f00", cursor: "pointer", padding: "2px 10px" }}>CLOSE [X]</button>
        </div>

        {/* IDE Component */}
        <div style={{ flex: 1, overflow: "hidden" }}>
            <ForthIDE />
        </div>
    </div>
  );
};
