
import React, { useState, useEffect, useRef } from 'react';
import { GRID_FORTH_SOURCE, GRID_AJS_SOURCE } from "../kernels/GridKernel";
import { HIVE_FORTH_SOURCE, HIVE_AJS_SOURCE } from "../kernels/HiveKernel";
import { PLAYER_FORTH_SOURCE, PLAYER_AJS_SOURCE } from "../kernels/PlayerKernel";
import { BATTLE_FORTH_SOURCE, BATTLE_AJS_SOURCE } from "../kernels/BattleKernel";
import { STANDARD_KERNEL_FIRMWARE } from "../kernels/SharedBlocks";
import { forthService, BusPacket } from "../services/WaForthService";
import { AetherTranspiler } from "../compiler/AetherTranspiler";

export const ForthIDE: React.FC = () => {
  const [mode, setMode] = useState<"ATTACH" | "STARTUP">("ATTACH");
  const [attachedInstanceId, setAttachedInstanceId] = useState<string>("");
  const [availableInstances, setAvailableInstances] = useState<string[]>([]);
  
  // Split State
  const [forthCode, setForthCode] = useState<string>("");
  const [ajsCode, setAjsCode] = useState<string>("");
  
  // View State: SOURCE (AetherJS) or COMPILED (Forth)
  const [bottomPaneMode, setBottomPaneMode] = useState<"SOURCE" | "COMPILED">("SOURCE");
  
  const [output, setOutput] = useState<string[]>([]);
  const [status, setStatus] = useState<"IDLE" | "COMPILING" | "READY" | "ERROR">("IDLE");
  const [lastError, setLastError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState<boolean>(true);
  const [pausedLine, setPausedLine] = useState<number | null>(null);
  const [symbolTable, setSymbolTable] = useState<Map<string, string>>(new Map());
  
  const [replInput, setReplInput] = useState("");
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Breakpoint Event Listener
  useEffect(() => {
      let targetId = attachedInstanceId;
      if (!targetId) return;

      const proc = forthService.get(targetId);
      const handleBP = (line: number) => {
          setPausedLine(line);
      };
      proc.onBreakpoint = handleBP;
      return () => { proc.onBreakpoint = null; };
  }, [mode, attachedInstanceId]);

  // Update symbol table when transpiling
  useEffect(() => {
      if (mode === "ATTACH" && attachedInstanceId) {
          // If we attach, we don't have the symbol table automatically unless we recompiled it
          // Realistically, the IDE would save the symbol table alongside the flashed logic.
          // For now, we fetch the last generated one.
          setSymbolTable(AetherTranspiler.lastSymbolTable);
      }
  }, [mode, attachedInstanceId, ajsCode]);

  // Subscribe to instance list changes
  useEffect(() => {
      const updateInstances = () => {
          setAvailableInstances(Array.from(forthService.processes.keys()));
      };
      updateInstances(); // Initial load
      const unsub = forthService.subscribe(updateInstances);
      return () => unsub();
  }, []);

  // Initialize Code
  useEffect(() => {
    if (!attachedInstanceId) return;

    // Based on the selected instance ID, infer the type and load the default source code
    // if the user wants to debug or restart the logic.
    let baseForth = "";
    let baseAjs = "";

    if (attachedInstanceId.includes("GRID") || attachedInstanceId.startsWith("10")) {
        baseForth = GRID_FORTH_SOURCE;
        baseAjs = GRID_AJS_SOURCE;
    } else if (attachedInstanceId.includes("HIVE") || attachedInstanceId.startsWith("30")) {
        baseForth = HIVE_FORTH_SOURCE;
        baseAjs = HIVE_AJS_SOURCE;
    } else if (attachedInstanceId.includes("PLAYER") || attachedInstanceId === "2") {
        baseForth = PLAYER_FORTH_SOURCE;
        baseAjs = PLAYER_AJS_SOURCE;
    } else if (attachedInstanceId.includes("BATTLE") || attachedInstanceId.startsWith("40")) {
        baseForth = BATTLE_FORTH_SOURCE;
        baseAjs = BATTLE_AJS_SOURCE;
    } else {
        baseForth = ": TEST S\" Hello World\" S. ; \nTEST";
        baseAjs = "// Scratch JS\nLog('Hello from AJS');";
    }

    if (mode === "STARTUP") {
        setForthCode(baseForth);
        setAjsCode(baseAjs);
    } else if (mode === "ATTACH") {
        // Only override code in ATTACH mode if it's currently empty, to avoid wiping unsaved changes
        if (!forthCode) setForthCode(baseForth);
        if (!ajsCode) setAjsCode(baseAjs);
    }

    setStatus("IDLE");
  }, [attachedInstanceId, mode]);

  // Logs
  useEffect(() => {
      let targetId = attachedInstanceId;
      if (!targetId) return;

      const proc = forthService.get(targetId);
      setOutput([...proc.outputLog]);
      const handleLog = (msg: string) => setOutput(prev => [...prev, msg].slice(-200));
      proc.addLogListener(handleLog);
      return () => { proc.removeLogListener(handleLog); };
  }, [attachedInstanceId, mode]);

  useEffect(() => outputEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [output]);

  const handleCompile = async () => {
    setStatus("COMPILING");
    setLastError(null);

    // If we are in STARTUP/SWAP mode, we compile to a temporary scratchpad process
    // and then, if applicable, swap it into the running instances of that type.
    const isSwapMode = mode === "STARTUP";
    if (!attachedInstanceId) {
        setLastError("No target selected");
        setStatus("ERROR");
        return;
    }

    // Determine type for scratch naming
    let inferredType = "UNKNOWN";
    if (attachedInstanceId.includes("GRID") || attachedInstanceId.startsWith("10")) inferredType = "GRID";
    if (attachedInstanceId.includes("PLAYER") || attachedInstanceId === "2") inferredType = "PLAYER";
    if (attachedInstanceId.includes("HIVE") || attachedInstanceId.startsWith("30")) inferredType = "HIVE";
    if (attachedInstanceId.includes("BATTLE") || attachedInstanceId.startsWith("40")) inferredType = "BATTLE";

    const compileId = isSwapMode ? `SCRATCH_${inferredType}` : attachedInstanceId;
    const proc = forthService.get(compileId);
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
            // Determine kernel ID for transpiler (rough guess based on type)
            let kid = 0;
            const checkType = attachedInstanceId;
            if (checkType.includes("GRID") || checkType.startsWith("10")) kid = 1;
            if (checkType.includes("PLAYER") || checkType === "2") kid = 2;
            if (checkType.includes("HIVE") || checkType.startsWith("30")) kid = 3;
            if (checkType.includes("BATTLE") || checkType.startsWith("40")) kid = 4;

            const transpiled = AetherTranspiler.transpile(ajsCode, kid, debugMode);
            
            if (sourceToRun.includes("( %%%_AJS_INJECTION_%%% )")) {
                sourceToRun = sourceToRun.replace("( %%%_AJS_INJECTION_%%% )", transpiled);
            } else {
                // If marker missing, just append
                sourceToRun += "\n" + transpiled;
            }
            setSymbolTable(AetherTranspiler.lastSymbolTable);
        }
        
        proc.log("--- INJECTING CODE ---");
        proc.run(sourceToRun);

        // 3. Swap Logic (If in STARTUP mode)
        if (isSwapMode && attachedInstanceId) {
             proc.log(`--- SWAPPING LOGIC TO TARGET INSTANCE: ${attachedInstanceId} ---`);
             const targetProc = forthService.processes.get(attachedInstanceId);
             if (targetProc) {
                 await targetProc.swapWith(proc);
                 targetProc.log("--- LOGIC HOT-SWAPPED ---");
             } else {
                 proc.log(`[ERR] Target instance ${attachedInstanceId} not found.`);
             }
        }

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
      const targetId = attachedInstanceId;
      if (!targetId) return;

      const proc = forthService.get(targetId);
      proc.log(`> ${replInput}`);
      try { proc.run(replInput); } catch (e) { }
      setReplInput("");
  };

  // Compute the displayed code for the bottom pane
  const getBottomPaneContent = () => {
      if (bottomPaneMode === "SOURCE") return ajsCode;
      try {
          return AetherTranspiler.transpile(ajsCode, 0, debugMode);
      } catch (e: any) {
          return `( ERROR: ${e.message} )`;
      }
  };

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column', background: '#111', color: '#0f0', fontFamily: 'monospace' }}>
      
      {/* HEADER */}
      <div style={{ padding: '10px', background: '#000', borderBottom: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>AETHER_IDE // SPLIT_VIEW</span>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <label style={{ cursor: 'pointer' }}>
                        <input type="radio" checked={mode === "ATTACH"} onChange={() => setMode("ATTACH")} /> Attach
                    </label>
                    <label style={{ cursor: 'pointer' }}>
                        <input type="radio" checked={mode === "STARTUP"} onChange={() => setMode("STARTUP")} /> Startup/Swap
                    </label>
                </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={debugMode} onChange={e => setDebugMode(e.target.checked)} />
                    Enable Tracing/Breakpoints (DEBUG_MODE)
                </label>
                <button onClick={handleCompile} style={{ background: '#00f', color: '#fff', border: 'none', padding: '5px 15px', cursor: 'pointer' }}>
                    {status === 'COMPILING' ? '...' : 'COMPILE & RUN'}
                </button>
            </div>
        </div>

        {/* Dynamic Context Bar */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: '#222', padding: '5px', borderRadius: '3px' }}>
            <span style={{ fontSize: '0.9em', color: '#aaa' }}>
                {mode === "ATTACH" ? "Target Instance:" : "Base Kernel Logic:"}
            </span>
            <select
                value={attachedInstanceId}
                onChange={(e) => setAttachedInstanceId(e.target.value)}
                style={{ background: '#000', color: '#0f0', border: '1px solid #444', padding: '3px' }}
            >
                <option value="">-- Select Active Kernel --</option>
                {availableInstances.map(inst => (
                    <option key={inst} value={inst}>{inst}</option>
                ))}
            </select>
            {mode === "STARTUP" && attachedInstanceId && (
                <span style={{ fontSize: '0.8em', color: '#f55' }}>
                    * Compiling will replace the logic of instance {attachedInstanceId} specifically.
                </span>
            )}
        </div>
      </div>

      {/* EDITOR VIEW */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* LEFT: VARIABLES / WATCH (Only if attached and debugging) */}
          {mode === "ATTACH" && debugMode && (
              <div style={{ width: '250px', background: '#080808', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '5px', background: '#111', color: '#ff0', fontSize: '0.8em' }}>VARIABLES / STATE (SYMBOL TABLE)</div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '10px', fontSize: '12px', color: '#ccc' }}>
                      {Array.from(symbolTable.entries()).map(([jsName, forthName]) => {
                          const proc = forthService.get(attachedInstanceId);
                          let valStr = "???";
                          if (proc && proc.isReady) {
                              try {
                                  // Simplified reading: try to evaluate the forth variable
                                  // Real implementation would read from memory map directly.
                                  valStr = `(addr of ${forthName})`;
                              } catch(e) {}
                          }
                          return (
                              <div key={jsName} style={{ marginBottom: '5px', borderBottom: '1px solid #222', paddingBottom: '2px' }}>
                                  <span style={{ color: '#0af' }}>{jsName}</span>: <span style={{ color: '#aaa' }}>{valStr}</span>
                              </div>
                          );
                      })}
                      {symbolTable.size === 0 && <div style={{ color: '#555' }}>No symbols extracted. Compile AJS code first.</div>}
                  </div>
              </div>
          )}

          {/* SPLIT COLUMN: FORTH (TOP) / AJS (BOTTOM) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #333', position: 'relative' }}>

              {pausedLine !== null && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: '#a00', color: '#fff', padding: '5px', zIndex: 10, display: 'flex', justifyContent: 'space-between' }}>
                      <span>[DEBUGGER PAUSED] Execution hit breakpoint on line {pausedLine}.</span>
                      <button onClick={() => {
                          setPausedLine(null);
                          // Provide a way to tell the engine to unpause via custom event or service
                          const evt = new CustomEvent('RESUME_SIMULATION');
                          window.dispatchEvent(evt);
                      }} style={{ background: '#fff', color: '#a00', border: 'none', cursor: 'pointer', padding: '2px 10px' }}>RESUME</button>
                  </div>
              )}
              
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
