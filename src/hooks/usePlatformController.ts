
import React, { useCallback, useEffect } from 'react';
import { forthService } from '../services/WaForthService';
import { KernelID, getInstanceID } from '../types/Protocol';
import { MEMORY } from '../constants/Memory';

export const usePlatformController = (
    mode: string,
    currentLevelIdx: number,
    keysDown: React.MutableRefObject<Set<string>>,
    setDisplayBuffer: (buf: ArrayBuffer) => void,
    tickSimulation: () => void,
    lastTickTimeRef: React.MutableRefObject<number>,
    SIMULATION_TICK_RATE_MS: number
) => {
    const handlePlatformInput = React.useCallback((k: string) => {
        if (mode !== "PLATFORM") return;

        const physicsRole = KernelID.PLATFORM;
        const gridId = String(getInstanceID(physicsRole, currentLevelIdx));
        const platProc = forthService.get(gridId);

        if (platProc && platProc.isLogicLoaded) {
            if (k === "ArrowUp") platProc.run("CMD_JUMP");
            if (k === " ") platProc.run("CMD_INTERACT");
        }
    }, [mode, currentLevelIdx]);

    const runPlatformCycle = React.useCallback((time: number) => {
        if (mode !== "PLATFORM") return;

        const physicsRole = KernelID.PLATFORM;
        const gridId = String(getInstanceID(physicsRole, currentLevelIdx));
        const platProc = forthService.get(gridId);

        if (platProc && platProc.isLogicLoaded) {
            if (keysDown.current.has("ArrowLeft")) platProc.run("-1 CMD_MOVE");
            if (keysDown.current.has("ArrowRight")) platProc.run("1 CMD_MOVE");

            try {
                platProc.run("RUN_PLATFORM_CYCLE");
                const raw = platProc.getMemory() as ArrayBuffer;
                const vramSize = MEMORY.GRID_WIDTH * MEMORY.GRID_HEIGHT * 4;
                if (raw.byteLength >= MEMORY.VRAM_ADDR + vramSize) {
                    const vramSlice = raw.slice(MEMORY.VRAM_ADDR, MEMORY.VRAM_ADDR + vramSize);
                    setDisplayBuffer(vramSlice);
                }
            } catch (e) {
                console.error("Platform Cycle Error:", e);
            }
        }

        if (time - lastTickTimeRef.current > SIMULATION_TICK_RATE_MS) {
            tickSimulation();
            lastTickTimeRef.current = time;
        }
    }, [mode, currentLevelIdx, keysDown, setDisplayBuffer, tickSimulation, lastTickTimeRef, SIMULATION_TICK_RATE_MS]);

    React.useEffect(() => {
        const listener = (e: KeyboardEvent) => handlePlatformInput(e.key);
        window.addEventListener("keydown", listener);
        return () => window.removeEventListener("keydown", listener);
    }, [handlePlatformInput]);

    return { runPlatformCycle };
};
