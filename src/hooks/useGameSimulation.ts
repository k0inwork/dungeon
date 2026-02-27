import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { forthService } from "../services/WaForthService";
import { storageService } from "../services/StorageService";
import { generatorService, WorldData } from "../services/GeneratorService";
import { SimulationEngine } from "../services/SimulationEngine";
import { useKernelManager } from "./useKernelManager";
import { KernelID, getInstanceID } from "../types/Protocol";
import { LEVEL_CONFIGS } from "../config/LevelConfig";

const LEVEL_IDS = ["hub", "platformer_1", "roguelike", "platformer_2", "platformer_1_lower"];

export const useGameSimulation = (addLog: (msg: string) => void) => {
    const [mode, setMode] = useState<"BOOT" | "GENERATING" | "GRID" | "PLATFORM">("BOOT");
    const [worldInfo, setWorldInfo] = useState<WorldData | null>(null);
    const [currentLevelId, setCurrentLevelId] = useState<string>("hub");
    const currentLevelIdx = LEVEL_IDS.indexOf(currentLevelId);
    const [gameOver, setGameOver] = useState(false);
    const [saveExists, setSaveExists] = useState(false);

    const loadingLevel = useRef<boolean>(false);
    const initializedLevels = useRef<Set<string>>(new Set());
    const channelSubscriptions = useRef<Map<number, Set<number>>>(new Map());

    const simulationRef = useRef<{ worldInfo: WorldData | null, currentLevelId: string, currentLevelIdx: number }>({
        worldInfo: null,
        currentLevelId: "hub",
        currentLevelIdx: 0
    });

    useEffect(() => {
        simulationRef.current = { worldInfo, currentLevelId, currentLevelIdx };
    }, [worldInfo, currentLevelId, currentLevelIdx]);

    const transitionRef = useRef<any>(null);
    const playerMoveRef = useRef<any>(null);
    const gameOverRef = useRef<any>(null);

    const { ensureKernel } = useKernelManager(addLog);

    const handleLevelTransition = useCallback(async (targetLevelIdx: number) => {
        const targetLevelId = LEVEL_IDS[targetLevelIdx];
        const info = simulationRef.current.worldInfo;
        if (!targetLevelId || !info || targetLevelId === simulationRef.current.currentLevelId) return;

        addLog(`Transitioning to ${info.levels![targetLevelId].name}...`);
        setCurrentLevelId(targetLevelId);
        await loadLevel(info.levels![targetLevelId], simulationRef.current.currentLevelIdx);
    }, [addLog]);

    const engine = useMemo(() => new SimulationEngine({
        channelSubscriptions: channelSubscriptions.current,
        onGameOver: () => setGameOver(true),
        onPlayerMoved: (x, y) => playerMoveRef.current?.(x, y),
        onLevelTransition: (targetLevelIdx: number) => transitionRef.current?.(targetLevelIdx)
    }), []);

    useEffect(() => {
        transitionRef.current = handleLevelTransition;
    }, [handleLevelTransition]);

    const loadLevel = useCallback(async (level: any, sourceLevelIdx: number = -1) => {
        if (loadingLevel.current) return;
        loadingLevel.current = true;
        try {
            const lIdx = LEVEL_IDS.indexOf(level.id);
            const config = LEVEL_CONFIGS[level.simulation_mode];

            const kernels = await Promise.all(config.requiredKernels.map(k => {
                const instId = k.role === KernelID.PLAYER ? "PLAYER" : String(getInstanceID(k.role, lIdx));
                return ensureKernel(instId, k.blocks, lIdx);
            }));

            if (kernels.some(k => !k)) return;

            const isNewLevel = !initializedLevels.current.has(level.id);

            // 1. BOOT PHASE
            if (isNewLevel) {
                kernels.forEach(p => {
                    if (p.id.startsWith(String(KernelID.PLATFORM))) p.run("INIT_PLATFORMER");
                    else if (p.id.startsWith(String(KernelID.GRID))) p.run("INIT_MAP");
                    else if (p.id.startsWith(String(KernelID.HIVE))) p.run("INIT_HIVE");
                    else if (p.id.startsWith(String(KernelID.BATTLE))) p.run("INIT_BATTLE");
                });
            }

            const playerProc = forthService.get("PLAYER");
            if (playerProc && !playerProc.isWordDefined("PLAYER_LOADED_SIGNAL")) {
                playerProc.run("INIT_PLAYER_AUTO : PLAYER_LOADED_SIGNAL ;");
            }

            const physicsProc = kernels.find(k => k.id === String(getInstanceID(config.physicsRole, lIdx)));
            if (physicsProc) physicsProc.run(`${lIdx} SET_LEVEL_ID`);

            // 2. DATA LOADING PHASE
            if (isNewLevel && physicsProc) {
                let spawnX = 1, spawnY = 1;
                const defaultFloor = level.terrain_legend.find((t: any) => t.passable);
                const floorSymbol = defaultFloor?.symbol || '.';

                level.map_layout.forEach((row: string, y: number) => {
                    for (let x = 0; x < 40; x++) {
                        let char = row[x] || ' ';
                        if (char === '@') {
                            spawnX = x; spawnY = y;
                            char = floorSymbol;
                        }
                        const terrain = level.terrain_legend.find((t: any) => t.symbol === char);
                        let color = terrain?.color || 0x888888;
                        let type = terrain?.passable ? 0 : 1;
                        let targetId = terrain?.target_id ?? -1;
                        physicsProc.run(`${x} ${y} ${color} ${char.charCodeAt(0)} ${type} ${targetId} LOAD_TILE`);
                    }
                });

                physicsProc.run(`${spawnX} ${spawnY} 65280 64 1 SPAWN_ENTITY`);
                playerMoveRef.current?.(spawnX, spawnY);

                level.entities.forEach((e: any) => {
                    if (e.x === spawnX && e.y === spawnY) return;

                    let type = 1; // Passive NPC
                    if (e.taxonomy.class === "Aggressive") type = 2;
                    if (e.taxonomy.race === "Loot" || e.glyph.char === "$") type = 3;

                    physicsProc.run(`${e.x} ${e.y} ${e.glyph.color} ${e.glyph.char.charCodeAt(0)} ${type} SPAWN_ENTITY`);
                });

                initializedLevels.current.add(level.id);
            } else if (physicsProc) {
                let spawnX = 1, spawnY = 1;
                level.map_layout.forEach((row: string, y: number) => {
                    if (row.includes('@')) {
                        spawnX = row.indexOf('@');
                        spawnY = y;
                    }
                });
                physicsProc.run(`${spawnX} ${spawnY} CMD_TELEPORT`);
                playerMoveRef.current?.(spawnX, spawnY);
            }

            // 3. SYNC PHASE
            engine.runBroker(kernels, lIdx);
            kernels.forEach(p => {
                if (p.isLogicLoaded) p.run("PROCESS_INBOX");
            });

            if (level.simulation_mode === 'GRID' && physicsProc) {
                physicsProc.run("REDRAW_ALL");
            }

            setMode(level.simulation_mode);
            addLog(`Simulation Ready.`);
        } catch (e: any) {
            console.error("Load Level Error:", e);
            addLog(`ERR: Load Level Failed: ${e.message}`);
        } finally {
            loadingLevel.current = false;
        }
    }, [addLog, ensureKernel, engine]);

    const handleGenerate = useCallback(async (seed: string, isMock: boolean) => {
        setMode("GENERATING");
        initializedLevels.current = new Set();
        const world = isMock ? generatorService.generateMockWorld() : await generatorService.generateWorld(seed);
        setWorldInfo(world);
        setCurrentLevelId("hub");
        await loadLevel(world.levels!["hub"]);
    }, [loadLevel]);

    const saveGame = useCallback(async () => {
        if (!worldInfo) return;
        const forthState = await forthService.serializeAll();
        const gameState = { worldInfo, currentLevelId, forthState };
        await storageService.saveGame(gameState);
        addLog("GAME SAVED TO INDEXEDDB.");
        setSaveExists(true);
    }, [worldInfo, currentLevelId, addLog]);

    const loadGame = useCallback(async () => {
        try {
            const gameState = await storageService.loadGame();
            if (!gameState) {
                addLog("NO SAVE DATA FOUND.");
                return;
            }
            setWorldInfo(gameState.worldInfo);
            setCurrentLevelId(gameState.currentLevelId);
            await forthService.deserializeAll(gameState.forthState);

            initializedLevels.current = new Set();
            Object.values(gameState.forthState.processes).forEach((p: any) => {
                const lId = LEVEL_IDS[p.levelIdx];
                if (lId) initializedLevels.current.add(lId);
            });

            const currentLevel = gameState.worldInfo.levels[gameState.currentLevelId];
            setMode(currentLevel?.simulation_mode || "GRID");
            addLog("GAME LOADED SUCCESSFULLY.");
        } catch (e) {
            addLog("LOAD FAILED.");
        }
    }, [addLog]);

    useEffect(() => {
        const checkSave = async () => { setSaveExists(await storageService.hasSave()); };
        checkSave();
    }, []);

    const handleInspect = useCallback((x: number, y: number) => {
        const lIdx = currentLevelIdx;
        const battleId = String(getInstanceID(KernelID.BATTLE, lIdx));
        const battleProc = forthService.get(battleId);

        const config = LEVEL_CONFIGS[mode === "PLATFORM" ? "PLATFORM" : "GRID"];
        const gridId = String(getInstanceID(config.physicsRole, lIdx));
        const gridProc = forthService.get(gridId);

        if (!battleProc || !gridProc) return null;

        const gridMem = new Uint8Array(gridProc.getMemory());
        const entMapAddr = 0x31000;
        const entId = gridMem[entMapAddr + (y * 40 + x)];

        if (entId >= 0) {
            const rpgBase = 0xA0000 + (entId * 36);
            const battleMem = new DataView(battleProc.getMemory());
            if (rpgBase + 36 <= battleMem.byteLength) {
                return {
                    id: entId, x, y,
                    hp: battleMem.getInt32(rpgBase, true),
                    maxHp: battleMem.getInt32(rpgBase + 4, true),
                    atk: battleMem.getInt32(rpgBase + 8, true),
                    def: battleMem.getInt32(rpgBase + 12, true),
                    state: battleMem.getInt32(rpgBase + 24, true)
                };
            }
        }
        return null;
    }, [currentLevelIdx, mode]);

    return {
        mode, worldInfo, currentLevelId, currentLevelIdx, gameOver, saveExists,
        handleGenerate, saveGame, loadGame, engine, handleInspect,
        setPlayerMoveHandler: (h: any) => { playerMoveRef.current = h; }
    };
};
