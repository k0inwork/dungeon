import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { forthService, BusPacket } from "./src/services/WaForthService";
import { ArchitectView } from "./src/components/ArchitectView";
import { DebuggerConsole } from "./src/components/DebuggerConsole";
import { KernelMonitor } from "./src/components/ui/KernelMonitor";

// New Components & Hooks
import { BootScreen } from "./src/components/ui/BootScreen";
import { Header } from "./src/components/ui/Header";
import { PresentationLayer } from "./src/views/PresentationLayer";
import { useGameSimulation } from "./src/hooks/useGameSimulation";

// Expose forthService for testing analyzer
if (typeof window !== 'undefined') {
    (window as any).forthService = forthService;
}

const App = () => {
    const [viewMode, setViewMode] = useState<"GAME" | "ARCHITECT">("GAME");
    const [seed, setSeed] = useState("Cyberpunk Sewers");
    const [log, setLog] = useState<string[]>([]);

    // KERNEL MONITOR STATE
    const [showBus, setShowBus] = useState(false);
    const [busHistory, setBusHistory] = useState<BusPacket[]>([]);
    const [filterMovement, setFilterMovement] = useState(true);
    const [busCategory, setBusCategory] = useState("ALL");
    const [loadedKernelIds, setLoadedKernelIds] = useState<string[]>([]);

    const addLog = useCallback((msg: string) => {
        setLog(prev => [msg, ...prev].slice(0, 100));
    }, []);

    const {
        mode, worldInfo, currentLevelId, currentLevelIdx, gameOver, saveExists,
        handleGenerate, saveGame, loadGame, engine, handleInspect, setPlayerMoveHandler
    } = useGameSimulation(addLog);

    useEffect(() => {
        return forthService.subscribe((ids) => {
            setLoadedKernelIds(prev => {
                if (JSON.stringify(prev) === JSON.stringify(ids)) return prev;
                return [...ids];
            });
            setBusHistory([...forthService.getPacketLog()]);
        });
    }, []);

    return (
        <div style={{ background: "#000", color: "#0f0", minHeight: "100vh", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <Header
                mode={mode}
                viewMode={viewMode}
                setViewMode={setViewMode}
                onSave={saveGame}
            />

            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                {mode === "BOOT" && (
                    <BootScreen
                        seed={seed}
                        setSeed={setSeed}
                        saveExists={saveExists}
                        onGenerate={(e) => handleGenerate(seed, e.shiftKey)}
                        onLoad={loadGame}
                    />
                )}

                {mode === "GENERATING" && <div style={{ textAlign: "center" }}><h1>SYNCING KERNELS...</h1></div>}

                {viewMode === "GAME" && (mode === "GRID" || mode === "PLATFORM") && (
                    <PresentationLayer
                        mode={mode as any}
                        worldInfo={worldInfo}
                        currentLevelId={currentLevelId}
                        currentLevelIdx={currentLevelIdx}
                        log={log}
                        addLog={addLog}
                        engine={engine}
                        handleInspect={handleInspect}
                        setPlayerMoveHandler={setPlayerMoveHandler}
                    />
                )}

                {viewMode === "ARCHITECT" && worldInfo && <ArchitectView data={worldInfo} />}

                {gameOver && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,0,0,0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                        <h1 style={{ color: 'white', fontSize: '4em', textShadow: '0 0 20px black' }}>YOU DIED</h1>
                        <button onClick={() => window.location.reload()} style={{ background: 'white', color: 'black', padding: '10px 20px', border: 'none', cursor: 'pointer' }}>RESTART SIMULATION</button>
                    </div>
                )}
            </div>

            {showBus && (
                <KernelMonitor
                    loadedKernelIds={loadedKernelIds}
                    currentLevelIdx={currentLevelIdx}
                    busHistory={busHistory}
                    filterMovement={filterMovement}
                    setFilterMovement={setFilterMovement}
                    busCategory={busCategory}
                    setBusCategory={setBusCategory}
                />
            )}

            <div style={{ position: "absolute", bottom: "10px", right: "10px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
                <button onClick={() => setShowBus(!showBus)} style={{ background: showBus ? "#0f0" : "#000", border: "1px solid #0f0", color: showBus ? "#000" : "#0f0", fontFamily: "monospace", cursor: "pointer", zIndex: 999, padding: "5px 10px" }}>
                    {showBus ? 'BUS >>' : '<< BUS'}
                </button>
                <DebuggerConsole />
            </div>
        </div>
    );
};

const container = document.getElementById("root");
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
