import React, { useState, useEffect, useRef, useCallback } from "react";
import { SimulationShell } from "../components/ui/SimulationShell";
import { RogueSimulationView } from "./RogueSimulationView";
import { PlatformSimulationView } from "./PlatformSimulationView";
import { WorldData } from "../services/GeneratorService";
import { SimulationEngine } from "../services/SimulationEngine";
import { forthService } from "../services/WaForthService";
import { MEMORY } from "../constants/Memory";
import { getInstanceID, KernelID } from "../types/Protocol";
import { useGameInput } from "../hooks/useGameInput";

interface PresentationLayerProps {
    mode: "GRID" | "PLATFORM";
    worldInfo: WorldData | null;
    currentLevelId: string;
    currentLevelIdx: number;
    log: string[];
    addLog: (msg: string) => void;
    engine: SimulationEngine;
    handleInspect: (x: number, y: number) => any;
    setPlayerMoveHandler: (h: any) => void;
}

export const PresentationLayer: React.FC<PresentationLayerProps> = ({
    mode,
    worldInfo,
    currentLevelId,
    currentLevelIdx,
    log,
    addLog,
    engine,
    handleInspect,
    setPlayerMoveHandler
}) => {
    const [displayBuffer, setDisplayBuffer] = useState<ArrayBuffer | null>(null);
    const [playerPos, setPlayerPos] = useState({ x: 1, y: 1 });
    const [playerStats, setPlayerStats] = useState({ hp: 0, maxHp: 0, gold: 0, invCount: 0, inventory: [] as number[] });
    const [inspectStats, setInspectStats] = useState<any | null>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const keysDown = useGameInput();

    useEffect(() => {
        setPlayerMoveHandler((x: number, y: number) => {
            setPlayerPos({ x, y });
        });
    }, [setPlayerMoveHandler]);

    // Common Sync Logic
    useEffect(() => {
        const syncInterval = setInterval(() => {
            const playerProc = forthService.get("PLAYER");
            if (playerProc?.isLogicLoaded) {
                const mem = new DataView(playerProc.getMemory());
                const base = 0xC0000;
                const hp = mem.getInt32(base, true);
                const maxHp = mem.getInt32(base + 4, true);
                const invCount = mem.getInt32(base + 12, true);
                const inventory = [];
                for(let i=0; i<invCount; i++) inventory.push(mem.getInt32(base + 16 + (i*4), true));

                setPlayerStats(prev => {
                    if (prev.hp === hp && prev.maxHp === maxHp && prev.invCount === invCount && prev.inventory.length === inventory.length) return prev;
                    return { hp, maxHp, gold: 0, invCount, inventory };
                });
            }

            const physicsRole = mode === "PLATFORM" ? KernelID.PLATFORM : KernelID.GRID;
            const gridId = String(getInstanceID(physicsRole, currentLevelIdx));
            const gridProc = forthService.get(gridId);
            if (gridProc?.isLogicLoaded) {
                const raw = gridProc.getMemory();
                const vramSize = 40 * 20 * 4;
                const newBuf = raw.slice(MEMORY.VRAM_ADDR, MEMORY.VRAM_ADDR + vramSize);
                setDisplayBuffer(newBuf);
            }
        }, 50);
        return () => clearInterval(syncInterval);
    }, [mode, currentLevelIdx]);

    const tickSimulation = useCallback(() => {
        engine.tickSimulation(currentLevelIdx, mode, currentLevelId);
    }, [engine, currentLevelIdx, mode, currentLevelId]);

    const onInspect = useCallback((x: number, y: number) => {
        const stats = handleInspect(x, y);
        if (stats) setInspectStats(stats);
    }, [handleInspect]);

    return (
        <SimulationShell
            playerStats={playerStats}
            groundItems={[]} // TODO: Implement if needed
            log={log}
            worldInfo={worldInfo}
            logContainerRef={logContainerRef}
            inspectStats={inspectStats}
            onCloseInspector={() => setInspectStats(null)}
        >
            {mode === "GRID" ? (
                <RogueSimulationView
                    displayBuffer={displayBuffer}
                    playerPos={playerPos}
                    currentLevelIdx={currentLevelIdx}
                    currentLevelId={currentLevelId}
                    tickSimulation={tickSimulation}
                    addLog={addLog}
                    onInspect={onInspect}
                />
            ) : (
                <PlatformSimulationView
                    displayBuffer={displayBuffer}
                    currentLevelIdx={currentLevelIdx}
                    keysDown={keysDown}
                    tickSimulation={tickSimulation}
                    setDisplayBuffer={setDisplayBuffer}
                    onInspect={onInspect}
                />
            )}
        </SimulationShell>
    );
};
