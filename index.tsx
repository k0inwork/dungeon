import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { forthService, BusPacket } from "./src/services/WaForthService";
import { storageService } from "./src/services/StorageService";
import { generatorService, WorldData } from "./src/services/GeneratorService";
import { AIConfig } from "./src/components/AIConfig";
import { ArchitectView } from "./src/components/ArchitectView";
import { DebuggerConsole } from "./src/components/DebuggerConsole";
import { MEMORY } from "./src/constants/Memory";

import { GRID_KERNEL_BLOCKS } from "./src/kernels/GridKernel";
import { HIVE_KERNEL_BLOCKS } from "./src/kernels/HiveKernel";
import { PLAYER_KERNEL_BLOCKS } from "./src/kernels/PlayerKernel";
import { BATTLE_KERNEL_BLOCKS } from "./src/kernels/BattleKernel";
import { PLATFORM_KERNEL_BLOCKS } from "./src/kernels/PlatformKernel";
import { KernelID, getInstanceID, getRoleID } from "./src/types/Protocol";

// UI Components
import { PlayerHUD, ITEM_NAMES } from "./src/components/ui/PlayerHUD";
import { LogWindow } from "./src/components/ui/LogWindow";
import { EntityInspector } from "./src/components/ui/EntityInspector";
import { KernelMonitor } from "./src/components/ui/KernelMonitor";
import { GridView } from "./src/components/views/GridView";
import { PlatformView } from "./src/components/views/PlatformView";

// Hooks & Services
import { useGameInput } from "./src/hooks/useGameInput";
import { useKernelManager } from "./src/hooks/useKernelManager";
import { useGridController, PLAYER_SKILLS, PlayerSkill } from "./src/hooks/useGridController";
import { usePlatformController } from "./src/hooks/usePlatformController";
import { SimulationEngine } from "./src/services/SimulationEngine";

const LEVEL_IDS = ["hub", "platformer_1", "roguelike", "platformer_2", "platformer_1_lower"];
const SIMULATION_TICK_RATE_MS = 100;

const App = () => {
    // --- BASIC STATE ---
    const [mode, setMode] = useState<"BOOT" | "GENERATING" | "GRID" | "PLATFORM">("BOOT");
    const [viewMode, setViewMode] = useState<"GAME" | "ARCHITECT">("GAME");
    const [log, setLog] = useState<string[]>([]);
    const [seed, setSeed] = useState("Cyberpunk Sewers");
    const [worldInfo, setWorldInfo] = useState<WorldData | null>(null);
    const [currentLevelId, setCurrentLevelId] = useState<string>("hub");
    const currentLevelIdx = LEVEL_IDS.indexOf(currentLevelId);
    const [gameOver, setGameOver] = useState(false);
    const [saveExists, setSaveExists] = useState(false);

    // --- SHARED REFS ---
    const logContainerRef = useRef<HTMLDivElement>(null);
    const loadingLevel = useRef<boolean>(false);
    const initializedLevels = useRef<Set<string>>(new Set());
    const [displayBuffer, setDisplayBuffer] = useState<ArrayBuffer | null>(null);
    const [playerPos, setPlayerPos] = useState({ x: 1, y: 1 });
    const [playerStats, setPlayerStats] = useState({ hp: 0, maxHp: 0, gold: 0, invCount: 0, inventory: [] as number[] });
    const [groundItems, setGroundItems] = useState<string[]>([]);
    const [inspectStats, setInspectStats] = useState<any | null>(null);

    // KERNEL MONITOR STATE
    const [showBus, setShowBus] = useState(false);
    const [busHistory, setBusHistory] = useState<BusPacket[]>([]);
    const [filterMovement, setFilterMovement] = useState(true);
    const [busCategory, setBusCategory] = useState("ALL");
    const [loadedKernelIds, setLoadedKernelIds] = useState<string[]>([]);

    const logRef = useRef<((msg: string) => void) | null>(null);
    const addLog = useCallback((msg: string) => {
        setLog(prev => [msg, ...prev].slice(0, 100));
        logRef.current?.(msg);
    }, []);

    // --- SIMULATION ENGINE ---
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

    const handleLevelTransition = useCallback(async (targetLevelIdx: number) => {
        const targetLevelId = LEVEL_IDS[targetLevelIdx];
        const info = simulationRef.current.worldInfo;
        if (!targetLevelId || !info || targetLevelId === simulationRef.current.currentLevelId) return;

        addLog(`Transitioning to ${info.levels![targetLevelId].name}...`);
        setCurrentLevelId(targetLevelId);
        await loadLevel(info.levels![targetLevelId], simulationRef.current.currentLevelIdx);
    }, [addLog]); // Stable dependencies

    React.useEffect(() => {
        transitionRef.current = handleLevelTransition;
        playerMoveRef.current = (x: number, y: number) => {
            setPlayerPos({ x, y });
        };
        gameOverRef.current = () => setGameOver(true);
    }, [handleLevelTransition]);

    const engine = useMemo(() => new SimulationEngine({
        channelSubscriptions: channelSubscriptions.current,
        onGameOver: () => gameOverRef.current?.(),
        onPlayerMoved: (x, y) => playerMoveRef.current?.(x, y),
        onLevelTransition: (targetLevelId: number) => transitionRef.current?.(targetLevelId)
    }), []);

    const tickSimulation = useCallback(() => {
        const { worldInfo: info, currentLevelId: id, currentLevelIdx: idx } = simulationRef.current;
        const simMode = info?.levels![id]?.simulation_mode || "GRID";
        engine.tickSimulation(idx, simMode, id);
    }, [engine]);

    // --- HOOKS ---
    const keysDown = useGameInput();
    const { ensureKernel, loadKernel } = useKernelManager(addLog);

    const triggerPickup = React.useCallback(() => {
        const playerProc = forthService.get("PLAYER");
        if (playerProc && playerProc.isLogicLoaded) {
            playerProc.run(`0 OUT_PTR ! 305 2 1 ${playerPos.x} ${playerPos.y} 0 BUS_SEND`);
            tickSimulation();
        }
    }, [playerPos, tickSimulation]);

    const checkTarget = React.useCallback((x: number, y: number, skill: PlayerSkill): boolean => {
        const dist = Math.abs(x - playerPos.x) + Math.abs(y - playerPos.y);
        if (dist > skill.range) return false;
        if (skill.name === "HEAL") return x === playerPos.x && y === playerPos.y;
        return true;
    }, [playerPos]);

    const gridController = useGridController(
        mode, playerPos, tickSimulation, addLog, triggerPickup, checkTarget, currentLevelIdx
    );

    const lastTickTimeRef = React.useRef(0);
    const { runPlatformCycle } = usePlatformController(
        mode, currentLevelIdx, keysDown, setDisplayBuffer, tickSimulation, lastTickTimeRef, SIMULATION_TICK_RATE_MS
    );


    const handleInspect = (x: number, y: number) => {
        const lIdx = currentLevelIdx;
        const battleId = String(getInstanceID(KernelID.BATTLE, lIdx));
        const battleProc = forthService.get(battleId);
        const gridId = String(getInstanceID(worldInfo?.levels[currentLevelId]?.simulation_mode === 'PLATFORM' ? KernelID.PLATFORM : KernelID.GRID, lIdx));
        const gridProc = forthService.get(gridId);

        if (!battleProc || !gridProc) return;

        const gridMem = new Uint8Array(gridProc.getMemory());
        const entMapAddr = 0x31000;
        const entId = gridMem[entMapAddr + (y * 40 + x)];

        if (entId > 0 || entId === 0) {
            const rpgBase = 0xA0000 + (entId * 36);
            const battleMem = new DataView(battleProc.getMemory());
            if (rpgBase + 36 <= battleMem.byteLength) {
                setInspectStats({
                    id: entId, x, y,
                    hp: battleMem.getInt32(rpgBase, true),
                    maxHp: battleMem.getInt32(rpgBase + 4, true),
                    atk: battleMem.getInt32(rpgBase + 8, true),
                    def: battleMem.getInt32(rpgBase + 12, true),
                    state: battleMem.getInt32(rpgBase + 24, true)
                });
            }
        }
    };

    const loadLevel = React.useCallback(async (level: any, sourceLevelIdx: number = -1) => {
        if (loadingLevel.current) return;
        loadingLevel.current = true;
        try {
            const lIdx = LEVEL_IDS.indexOf(level.id);
            const physicsRole = level.simulation_mode === 'PLATFORM' ? KernelID.PLATFORM : KernelID.GRID;

            const gridId = String(getInstanceID(physicsRole, lIdx));
            const hiveId = String(getInstanceID(KernelID.HIVE, lIdx));
            const battleId = String(getInstanceID(KernelID.BATTLE, lIdx));

            const physicsBlocks = level.simulation_mode === 'PLATFORM' ? PLATFORM_KERNEL_BLOCKS : GRID_KERNEL_BLOCKS;

            const playerProc = await ensureKernel("PLAYER", PLAYER_KERNEL_BLOCKS, 0);
            const mainProc = await ensureKernel(gridId, physicsBlocks, lIdx);
            const hiveProc = await ensureKernel(hiveId, HIVE_KERNEL_BLOCKS, lIdx);
            const battleProc = await ensureKernel(battleId, BATTLE_KERNEL_BLOCKS, lIdx);

            if (!mainProc || !hiveProc || !battleProc || !playerProc) return;

            const isNewLevel = !initializedLevels.current.has(level.id);

            // 1. BOOT PHASE
            if (isNewLevel) {
                if (level.simulation_mode === 'PLATFORM') {
                    mainProc.run("INIT_PLATFORMER");
                } else {
                    mainProc.run("INIT_MAP");
                }
                hiveProc.run("INIT_HIVE");
                battleProc.run("INIT_BATTLE");
            }

            if (!playerProc.isWordDefined("PLAYER_LOADED_SIGNAL")) {
                playerProc.run("INIT_PLAYER_AUTO : PLAYER_LOADED_SIGNAL ;");
            }

            mainProc.run(`${lIdx} SET_LEVEL_ID`);

            // 2. DATA LOADING PHASE
            if (isNewLevel) {
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
                        mainProc.run(`${x} ${y} ${color} ${char.charCodeAt(0)} ${type} ${targetId} LOAD_TILE`);
                    }
                });

                // Spawning Player first with green color
                mainProc.run(`${spawnX} ${spawnY} 65280 64 1 SPAWN_ENTITY`);
                setPlayerPos({ x: spawnX, y: spawnY });

                // Spawning others
                level.entities.forEach((e: any) => {
                    if (e.x === spawnX && e.y === spawnY) return;
                    mainProc.run(`${e.x} ${e.y} ${e.glyph.color} ${e.glyph.char.charCodeAt(0)} ${e.taxonomy.class === "Aggressive" ? 2 : 1} SPAWN_ENTITY`);
                });

                initializedLevels.current.add(level.id);
            } else {
                // Teleport on re-entry
                let spawnX = 1, spawnY = 1;
                level.map_layout.forEach((row: string, y: number) => {
                    if (row.includes('@')) {
                        spawnX = row.indexOf('@');
                        spawnY = y;
                    }
                });
                mainProc.run(`${spawnX} ${spawnY} CMD_TELEPORT`);
                setPlayerPos({ x: spawnX, y: spawnY });
            }

            // 3. SYNC PHASE
            engine.runBroker([mainProc, hiveProc, battleProc, playerProc], lIdx);
            [mainProc, hiveProc, battleProc, playerProc].forEach(p => {
                if (p.isLogicLoaded) p.run("PROCESS_INBOX");
            });

            if (level.simulation_mode === 'GRID') {
                mainProc.run("REDRAW_ALL");
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

    const handleGenerate = useCallback(async (e: React.MouseEvent) => {
        setMode("GENERATING");
        initializedLevels.current = new Set();
        const world = e.shiftKey ? generatorService.generateMockWorld() : await generatorService.generateWorld(seed);
        setWorldInfo(world);
        setCurrentLevelId("hub");
        await loadLevel(world.levels!["hub"]);
    }, [seed, loadLevel]);

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

    // --- EFFECTS ---
    useEffect(() => {
        const checkSave = async () => { setSaveExists(await storageService.hasSave()); };
        checkSave();
    }, []);

    useEffect(() => {
        return forthService.subscribe((ids) => {
            setLoadedKernelIds(prev => {
                if (JSON.stringify(prev) === JSON.stringify(ids)) return prev;
                return [...ids];
            });
            setBusHistory([...forthService.getPacketLog()]);
        });
    }, []);

    React.useEffect(() => {
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

            if (mode === "GRID") {
                const gridId = String(getInstanceID(KernelID.GRID, currentLevelIdx));
                const gridProc = forthService.get(gridId);
                if (gridProc?.isLogicLoaded) {
                    const raw = gridProc.getMemory();
                    const vramSize = 40 * 20 * 4;
                    const newBuf = raw.slice(MEMORY.VRAM_ADDR, MEMORY.VRAM_ADDR + vramSize);

                    setDisplayBuffer(prev => {
                        if (prev && prev.byteLength === newBuf.byteLength) {
                            const p32 = new Uint32Array(prev);
                            const n32 = new Uint32Array(newBuf);
                            let match = true;
                            for(let i=0; i<p32.length; i++) if(p32[i] !== n32[i]) { match = false; break; }
                            if (match) return prev;
                        }
                        return newBuf;
                    });
                }
            }
        }, 50);

        return () => clearInterval(syncInterval);
    }, [mode, currentLevelId, currentLevelIdx]);

    const requestRef = React.useRef<number>(0);
    const animate = (time: number) => {
        if (mode === "PLATFORM") {
            runPlatformCycle(time);
        }
        requestRef.current = requestAnimationFrame(animate);
    };

    React.useEffect(() => {
        if (viewMode === "GAME") requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [mode, viewMode, runPlatformCycle]);

    return (
        <div style={{ background: "#000", color: "#0f0", minHeight: "100vh", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #0f0', zIndex: 30, background: '#000' }}>
                <div style={{ fontWeight: 'bold' }}>AI ROGUELIKE v2.2 [MODULAR]</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={saveGame} style={{ background: '#000', color: '#0f0', border: '1px solid #0f0', padding: '2px 10px', cursor: 'pointer' }}>SAVE</button>
                    <button onClick={() => setViewMode("GAME")} style={{ background: viewMode === "GAME" ? "#0f0" : "#000", color: viewMode === "GAME" ? "#000" : "#0f0", border: "1px solid #0f0", cursor: "pointer" }}>SIMULATION</button>
                    <button onClick={() => setViewMode("ARCHITECT")} style={{ background: viewMode === "ARCHITECT" ? "#f0f" : "#000", color: viewMode === "ARCHITECT" ? "#000" : "#f0f", border: "1px solid #f0f", cursor: "pointer" }}>ARCHITECT</button>
                </div>
                <div style={{ color: '#0f0', fontSize: '0.8em' }}>STATUS: {mode}</div>
            </div>

            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                {mode === "BOOT" && (
                    <div style={{ textAlign: "center" }}>
                        <h1>WORLD SEED INPUT</h1>
                        <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ background: "#000", border: "1px solid #0f0", color: "#0f0", padding: "10px", fontSize: "1.2em", width: "300px", textAlign: "center" }} />
                        <br /><br />
                        <div style={{ color: "#666", marginBottom: "10px" }}>Tip: Shift+Click for Instant Mock World</div>
                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                            <button onClick={handleGenerate} style={{ background: "#0f0", color: "#000", border: "none", padding: "10px 20px", fontSize: "1.2em", cursor: "pointer" }}>INITIATE GENERATION</button>
                            {saveExists && <button onClick={loadGame} style={{ background: "#00f", color: "#fff", border: "none", padding: "10px 20px", fontSize: "1.2em", cursor: "pointer" }}>LOAD LAST SESSION</button>}
                        </div>
                        <AIConfig />
                    </div>
                )}

                {mode === "GENERATING" && <div style={{ textAlign: "center" }}><h1>SYNCING KERNELS...</h1></div>}

                {viewMode === "GAME" && (mode === "GRID" || mode === "PLATFORM") && (
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <PlayerHUD playerStats={playerStats} groundItems={groundItems} />

                        {mode === "GRID" ? (
                            <GridView
                                displayBuffer={displayBuffer}
                                cursorPos={gridController.cursorPos}
                                playerPos={playerPos}
                                targetMode={gridController.targetMode}
                                selectedSkill={gridController.selectedSkill}
                                isValidTarget={gridController.isValidTarget}
                                currentLevelId={currentLevelId}
                                playerSkills={PLAYER_SKILLS}
                                handleInspect={handleInspect}
                                triggerPickup={triggerPickup}
                            />
                        ) : (
                            <PlatformView
                                displayBuffer={displayBuffer}
                                handleInspect={handleInspect}
                            />
                        )}

                        <LogWindow log={log} worldInfo={worldInfo} logContainerRef={logContainerRef} />
                        {inspectStats && <EntityInspector inspectStats={inspectStats} onClose={() => setInspectStats(null)} />}
                    </div>
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
