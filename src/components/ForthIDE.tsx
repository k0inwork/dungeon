
import React, { useState, useEffect, useRef } from 'react';
import { GRID_FORTH_SOURCE, GRID_AJS_SOURCE } from "../kernels/GridKernel";
import { HIVE_FORTH_SOURCE, HIVE_AJS_SOURCE } from "../kernels/HiveKernel";
import { PLAYER_FORTH_SOURCE, PLAYER_AJS_SOURCE } from "../kernels/PlayerKernel";
import { BATTLE_FORTH_SOURCE, BATTLE_AJS_SOURCE } from "../kernels/BattleKernel";
import { STANDARD_KERNEL_FIRMWARE } from "../kernels/SharedBlocks";
import { forthService, BusPacket } from "../services/WaForthService";
import { AetherTranspiler } from "../compiler/AetherTranspiler";

type KernelType = "GRID" | "HIVE" | "PLAYER" | "BATTLE" | "SCRATCH";

export const ForthIDE: React.FC = () => {
  const [activeKernel, setActiveKernel] = useState<KernelType>("GRID");
  
  // Split State
  const [forthCode, setForthCode] = useState<string>("");
  const [ajsCode, setAjsCode] = useState<string>("");
  
  // View State: SOURCE (AetherJS) or COMPILED (Forth)
  const [bottomPaneMode, setBottomPaneMode] = useState<"SOURCE" | "COMPILED">("SOURCE");
  
  const [output, setOutput] = useState<string[]>([]);
  const [status, setStatus] = useState<"IDLE" | "COMPILING" | "READY" | "ERROR">("IDLE");
  const [lastError, setLastError] = useState<string | null>(null);
  
  const [replInput, setReplInput] = useState("");
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Initialize Code
  useEffect(() => {
    switch(activeKernel) {
        case "GRID": 
            setForthCode(GRID_FORTH_SOURCE);
            setAjsCode(GRID_AJS_SOURCE);
            break;
        case "HIVE":
            setForthCode(HIVE_FORTH_SOURCE);
            setAjsCode(HIVE_AJS_SOURCE);
            break;
        case "PLAYER":
            setForthCode(PLAYER_FORTH_SOURCE);
            setAjsCode(PLAYER_AJS_SOURCE);
            break;
        case "BATTLE":
            setForthCode(BATTLE_FORTH_SOURCE);
            setAjsCode(BATTLE_AJS_SOURCE);
            break;
        case "SCRATCH": 
            setForthCode(": TEST S\" Hello World\" S. ; \nTEST");
            setAjsCode("// Scratch JS\nLog('Hello from AJS');");
            break;
    }
    setStatus("IDLE");
  }, [activeKernel]);

  // Logs
  useEffect(() => {
      const proc = forthService.get(activeKernel);
      setOutput([...proc.outputLog]);
      const handleLog = (msg: string) => setOutput(prev => [...prev, msg].slice(-200));
      proc.addLogListener(handleLog);
      return () => { proc.removeLogListener(handleLog); };
  }, [activeKernel]);

  useEffect(() => outputEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [output]);

  const handleCompile = async () => {
    setStatus("COMPILING");
    setLastError(null);
    const proc = forthService.get(activeKernel);
    try {
        proc.log("--- REBOOTING KERNEL ---");
        await proc.boot(); 
        
        // 1. Load Firmware
        proc.log("--- LOADING FIRMWARE ---");
        proc.run(STANDARD_KERNEL_FIRMWARE.join("\n"));

        let sourceToRun = forthCode;

        // 2. Transpile AJS
        if (ajsCode.trim()) {
            proc.log("--- TRANSPILING AETHER JS ---");
            const transpiled = AetherTranspiler.transpile(ajsCode);
            
            if (sourceToRun.includes("( %%%_AJS_INJECTION_%%% )")) {
                sourceToRun = sourceToRun.replace("( %%%_AJS_INJECTION_%%% )", transpiled);
            } else {
                // If marker missing, just append
                sourceToRun += "\n" + transpiled;
            }
        }
        
        proc.log("--- INJECTING CODE ---");
        proc.run(sourceToRun);
        setStatus("READY");
        proc.log("--- SUCCESS ---");
    } catch (e: any) {
        setStatus("ERROR");
        setLastError(e.message);
        proc.log(`[COMPILER ERROR] ${e.message}`);
    }
  };

  const handleReplSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!replInput.trim()) return;
      const proc = forthService.get(activeKernel);
      proc.log(`> ${replInput}`);
      try { proc.run(replInput); } catch (e) { }
      setReplInput("");
  };

  // Compute the displayed code for the bottom pane
  const getBottomPaneContent = () => {
      if (bottomPaneMode === "SOURCE") return ajsCode;
      try {
          return AetherTranspiler.transpile(ajsCode);
      } catch (e: any) {
          return `( ERROR: ${e.message} )`;
      }
  };

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column', background: '#111', color: '#0f0', fontFamily: 'monospace' }}>
      
      {/* HEADER */}
      <div style={{ padding: '10px', background: '#000', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>AETHER_IDE // SPLIT_VIEW</span>
            
            <div style={{ display: 'flex', gap: '5px' }}>
                {(['GRID', 'HIVE', 'PLAYER', 'BATTLE', 'SCRATCH'] as KernelType[]).map(k => (
                    <button key={k} onClick={() => setActiveKernel(k)} style={{ background: activeKernel === k ? '#0f0' : '#222', color: activeKernel === k ? '#000' : '#888', border: 'none', padding: '5px 10px', cursor: 'pointer', fontSize: '0.8em' }}>{k}</button>
                ))}
            </div>
        </div>
        
        <button onClick={handleCompile} style={{ background: '#00f', color: '#fff', border: 'none', padding: '5px 15px', cursor: 'pointer' }}>
            {status === 'COMPILING' ? '...' : 'COMPILE & RUN'}
        </button>
      </div>

      {/* EDITOR VIEW */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* SPLIT COLUMN: FORTH (TOP) / AJS (BOTTOM) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #333' }}>
              
              {/* TOP: FORTH */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '30%' }}>
                   <div style={{ padding: '5px', background: '#222', color: '#888', fontSize: '0.8em', display: 'flex', justifyContent: 'space-between' }}>
                      <span>FORTH HOST (MEMORY & INFRASTRUCTURE)</span>
                   </div>
                   <textarea
                      value={forthCode}
                      onChange={(e) => setForthCode(e.target.value)}
                      style={{ flex: 1, background: '#111', color: '#aaa', border: 'none', padding: '10px', fontFamily: 'monospace', fontSize: '12px', resize: 'none', outline: 'none' }}
                      spellCheck={false}
                  />
              </div>

              {/* DIVIDER */}
              <div style={{ height: '5px', background: '#333', cursor: 'row-resize' }}></div>

              {/* BOTTOM: AJS */}
              <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column' }}>
                   <div 
                      onClick={() => setBottomPaneMode(prev => prev === "SOURCE" ? "COMPILED" : "SOURCE")}
                      style={{ padding: '5px', background: '#220022', color: '#f0f', fontSize: '0.8em', cursor: 'pointer', userSelect: 'none' }}
                   >
                      {bottomPaneMode === "SOURCE" ? "AETHER JS (LOGIC & BEHAVIOR) [CLICK TO SEE COMPILED]" : "FORTH (TRANSPILED RESULT) [CLICK TO SEE SOURCE]"}
                   </div>
                   <textarea
                      value={getBottomPaneContent()}
                      onChange={(e) => bottomPaneMode === "SOURCE" ? setAjsCode(e.target.value) : null}
                      readOnly={bottomPaneMode === "COMPILED"}
                      style={{ 
                          flex: 1, 
                          background: bottomPaneMode === "SOURCE" ? '#080008' : '#001100', 
                          color: bottomPaneMode === "SOURCE" ? '#eee' : '#8f8', 
                          border: 'none', 
                          padding: '10px', 
                          fontFamily: 'monospace', 
                          fontSize: '14px', 
                          resize: 'none', 
                          outline: 'none' 
                      }}
                      spellCheck={false}
                  />
              </div>

          </div>
          
          {/* CONSOLE (RIGHT) */}
          <div style={{ width: '350px', display: 'flex', flexDirection: 'column', background: '#050505' }}>
              <div style={{ padding: '5px', background: '#181818', color: '#aaa', fontSize: '0.8em' }}>CONSOLE</div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px', fontSize: '12px' }}>
                 {output.map((line, i) => (
                     <div key={i} style={{ color: line.includes('[ERR]') || line.includes('ERROR') ? '#f55' : '#ccc', marginBottom: '2px' }}>{line}</div>
                 ))}
                 <div ref={outputEndRef} />
              </div>
              <form onSubmit={handleReplSubmit} style={{ display: 'flex', borderTop: '1px solid #333' }}>
                 <span style={{ padding: '10px', background: '#000', color: '#0f0' }}>&gt;</span>
                 <input type="text" value={replInput} onChange={(e) => setReplInput(e.target.value)} style={{ flex: 1, background: '#000', color: '#fff', border: 'none', padding: '10px', outline: 'none', fontFamily: 'monospace' }} />
              </form>
          </div>
      </div>
    </div>
  );
};
