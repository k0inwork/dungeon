import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { forthService, BusPacket } from "./src/services/WaForthService";
import { storageService } from "./src/services/StorageService";
import { PlatformerPhysics } from "./src/systems/PlatformerPhysics";
import { TerminalCanvas } from "./src/components/TerminalCanvas";
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
import { KernelID, Opcode, PACKET_SIZE_INTS, getInstanceID, getRoleID } from "./src/types/Protocol";

const LEVEL_IDS = ["hub", "platformer_1", "roguelike", "platformer_2", "platformer_1_lower"];

type GameMode = "BOOT" | "GENERATING" | "GRID" | "PLATFORM";
type ViewMode = "GAME" | "ARCHITECT";

interface EntityStats {
    id: number;
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    state: number;
    x: number;
    y: number;
}

interface PlayerSkill {
    id: number;
    name: string;
    key: string;
    description: string;
    range: number;
}

// Hardcoded Skills for Prototype (Class: Mage/Warrior Hybrid)
const PLAYER_SKILLS: PlayerSkill[] = [
    { id: 0, key: '1', name: "MELEE", description: "Basic Attack", range: 1 },
    { id: 1, key: '2', name: "SMASH", description: "Heavy Damage (x2)", range: 1 },
    { id: 2, key: '3', name: "HEAL", description: "Self Heal (+20)", range: 0 },
    { id: 3, key: '4', name: "FIREBALL", description: "Ranged 40 DMG", range: 5 },
];

const SIMULATION_TICK_RATE_MS = 100; // 10 ticks per second for Real-Time modes

const App = () => {
  const [mode, setMode] = useState<GameMode>("BOOT");
  const [viewMode, setViewMode] = useState<ViewMode>("GAME");
  const [log, setLog] = useState<string[]>([]);
  const [seed, setSeed] = useState("Cyberpunk Sewers");
  const [worldInfo, setWorldInfo] = useState<WorldData | null>(null);
  const [currentLevelId, setCurrentLevelId] = useState<string>("hub");
  const currentLevelIdx = LEVEL_IDS.indexOf(currentLevelId);

  // Track successful kernel loads to prevent loop execution if load failed
  const [activeKernels, setActiveKernels] = useState<Set<string>>(new Set());
  const [loadedKernelIds, setLoadedKernelIds] = useState<string[]>([]);
  const initializedLevels = useRef<Set<string>>(new Set());
  const loadingKernels = useRef<Map<string, Promise<any>>>(new Map());
  const [gameOver, setGameOver] = useState(false);

  // Persistent HUD State
  const [playerStats, setPlayerStats] = useState({ hp: 0, maxHp: 0, gold: 0, inv: 0 });
  const [groundItems, setGroundItems] = useState<string[]>([]);

  // Bus Log Sidebar State
  const [showBus, setShowBus] = useState(false);
  const [busHistory, setBusHistory] = useState<BusPacket[]>([]);
  const [filterMovement, setFilterMovement] = useState(true); // Default ON to prevent spam
  const [busFilterCategory, setBusFilterCategory] = useState<"ALL" | "BUS" | "KERNEL" | "CHANNEL">("ALL");
  const [busFilterValue, setBusFilterValue] = useState<string>("");
  
  // Inspector & Targeting State
  const [inspectStats, setInspectStats] = useState<EntityStats | null>(null);
  const [targetMode, setTargetMode] = useState(false);
  const [playerPos, setPlayerPos] = useState({ x: 5, y: 5 });
  const [cursorPos, setCursorPos] = useState({ x: 5, y: 5 }); // Default start
  const [selectedSkill, setSelectedSkill] = useState<PlayerSkill | null>(null);
  const [isValidTarget, setIsValidTarget] = useState(true);

  const platformerRef = useRef(new PlatformerPhysics());
  const keysDownRef = useRef<Set<string>>(new Set());
  const requestRef = useRef<number>(0);
  const lastTickTimeRef = useRef<number>(0);

  const [displayBuffer, setDisplayBuffer] = useState<ArrayBuffer | null>(null);
  const localBufferRef = useRef(new Uint32Array(MEMORY.GRID_WIDTH * MEMORY.GRID_HEIGHT));
  const logContainerRef = useRef<HTMLDivElement>(null);

  const channelSubscriptions = useRef<Map<number, Set<number>>>(new Map());

  // Increased log size to 100
  const addLog = (msg: string) => setLog(prev => [msg, ...prev].slice(0, 100));

  // Auto-scroll Log
  useEffect(() => {
      if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
  }, [log]);

  useEffect(() => {
    return forthService.subscribe((ids) => {
        setLoadedKernelIds([...ids]);
    });
  }, []);
  
  // Hook into Forth Kernel Logs (Global Bridge)
  useEffect(() => {
      const handleKernelLog = (msg: string) => {
          // Filter for gameplay relevant info
          // We want [PLAYER], [BATTLE], or anything mentioning "Attack/Damage/Die"
          const isGameplay = msg.includes("PLAYER") || msg.includes("BATTLE") || msg.includes("HIVE") || 
                             msg.includes("GRID") || msg.includes("PLATFORM") ||
                             msg.includes("Attack") || msg.includes("Hits") || msg.includes("Die") || msg.includes("Loot");
                             
          if (isGameplay) {
              // Strip timestamp for UI cleanliness
              const cleanMsg = msg.replace(/^\[.*?\]\s*/, "> ");
              addLog(cleanMsg);
          }
      };
      return forthService.subscribeLogs(handleKernelLog);
  }, []);
  
  // Subscribe to Bus with Filtering
  useEffect(() => {
    return forthService.subscribeBus(() => {
        if (showBus) {
            updateBusHistory();
        }
    });
  }, [showBus, filterMovement, busFilterCategory, busFilterValue]);

  const updateBusHistory = () => {
      let hist = forthService.busHistory;

      if (filterMovement) {
          // FILTER OUT NOISE: MOVEMENT and COLLISIONS
          hist = hist.filter(p => 
              p.op !== "REQ_MOVE" && 
              p.op !== "EVT_MOVED" && 
              p.op !== "EVT_COLLIDE"
          );
      }

      if (busFilterCategory === "BUS") {
          hist = hist.filter(p => p.targetId === KernelID.BUS);
      } else if (busFilterCategory === "KERNEL") {
          if (busFilterValue) {
              hist = hist.filter(p => p.target === busFilterValue || p.sender === busFilterValue);
          } else {
              // All Kernel events (target < 1000 and != BUS)
              hist = hist.filter(p => p.targetId < 1000 && p.targetId !== KernelID.BUS);
          }
      } else if (busFilterCategory === "CHANNEL") {
          if (busFilterValue) {
              hist = hist.filter(p => p.target === busFilterValue || String(p.targetId) === busFilterValue);
          } else {
              hist = hist.filter(p => p.targetId >= 1000);
          }
      }

      setBusHistory([...hist]);
  };

  // Update Bus history immediately when opening sidebar or changing filters
  useEffect(() => {
      if (showBus) updateBusHistory();
  }, [showBus, filterMovement, busFilterCategory, busFilterValue]);

  // --- CONSOLE INTERCEPTOR ---
  // Captures browser errors and displays them in the game terminal
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;

    const safeStringify = (arg: any) => {
        try {
            if (arg instanceof Error) return arg.message;
            if (typeof arg === 'object') return JSON.stringify(arg);
            return String(arg);
        } catch { return "[Circular/Unserializable]"; }
    };

    console.error = (...args: any[]) => {
        const msg = args.map(safeStringify).join(" ");
        setLog(prev => [`[SYS_ERR] ${msg}`, ...prev].slice(0, 50));
        originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
        const msg = args.map(safeStringify).join(" ");
        setLog(prev => [`[SYS_WARN] ${msg}`, ...prev].slice(0, 50));
        originalWarn.apply(console, args);
    };

    return () => {
        console.error = originalError;
        console.warn = originalWarn;
    };
  }, []);
  // ---------------------------

  const loadKernel = async (id: string, blocks: string[], lIdx: number = 0) => {
      try {
          console.log(`[HOST] Loading Kernel ${id} for Level ${lIdx}...`);
          await forthService.bootProcess(id);
          const proc = forthService.get(id);
          proc.levelIdx = lIdx;
          proc.logicBlocks = blocks; // Store for restoration
          proc.status = "ACTIVE";
          addLog(`${id} Kernel Initialized.`);
          
          for (let i = 0; i < blocks.length; i++) {
              try {
                  proc.run(blocks[i]);
              } catch (e) {
                  console.error(`Error in ${id} Block ${i}:`, e, "Block Content:", blocks[i]);
                  addLog(`ERR: ${id} Block ${i} Failed`);
                  throw e; // Fail loud if firmware or logic fails
              }
          }
          proc.isLogicLoaded = true;
          addLog(`${id} Logic Loaded. READY.`);
          setActiveKernels(prev => new Set(prev).add(id));
          return proc;
      } catch (e) {
          console.error(`Failed to load ${id}`, e);
          addLog(`CRITICAL: ${id} Load Aborted.`);
          return null;
      }
  };

  const ensureKernel = async (id: string, blocks: string[], lIdx: number) => {
    const proc = forthService.get(id);
    if (proc.status === "FLASHED") {
        await proc.awaken();
        return proc;
    }
    if (proc.isLogicLoaded) {
        proc.status = "ACTIVE";
        return proc;
    }

    if (loadingKernels.current.has(id)) {
        return await loadingKernels.current.get(id);
    }

    const loadPromise = loadKernel(id, blocks, lIdx);
    loadingKernels.current.set(id, loadPromise);
    try {
        return await loadPromise;
    } finally {
        loadingKernels.current.delete(id);
    }
  };

  // Boot Initial Kernels
  useEffect(() => {
    const bootSystem = async () => {
        // Boot Player (Singleton)
        await loadKernel("PLAYER", PLAYER_KERNEL_BLOCKS, 0);
    };
    bootSystem();
    return () => cancelAnimationFrame(requestRef.current!);
  }, []);

  const loadLevel = async (level: any, sourceLevelIdx: number = -1) => {
    const lIdx = LEVEL_IDS.indexOf(level.id);
    const gridId = String(getInstanceID(KernelID.GRID, lIdx));
    const hiveId = String(getInstanceID(KernelID.HIVE, lIdx));
    const battleId = String(getInstanceID(KernelID.BATTLE, lIdx));

    const physicsBlocks = level.kernel_overrides?.physics || (level.simulation_mode === 'PLATFORM' ? PLATFORM_KERNEL_BLOCKS : GRID_KERNEL_BLOCKS);
    const aiBlocks = level.kernel_overrides?.ai || HIVE_KERNEL_BLOCKS;
    const statsBlocks = level.kernel_overrides?.stats || BATTLE_KERNEL_BLOCKS;

    const mainProc = await ensureKernel(gridId, physicsBlocks, lIdx);
    const hiveProc = await ensureKernel(hiveId, aiBlocks, lIdx);
    const battleProc = await ensureKernel(battleId, statsBlocks, lIdx);
    const playerProc = await ensureKernel("PLAYER", PLAYER_KERNEL_BLOCKS, 0);

    if (!mainProc || !hiveProc || !battleProc || !playerProc) {
        addLog("CRITICAL: Failed to ensure required kernels.");
        return;
    }

    if (initializedLevels.current.has(level.id)) {
        console.log(`[SYS] Returning to level: ${level.id}`);
        addLog(`Returning to ${level.name}...`);

        // Determine entry position based on where we came from
        let entryX = -1, entryY = -1;
        if (sourceLevelIdx !== -1) {
            level.map_layout.forEach((row: string, y: number) => {
                for (let x = 0; x < MEMORY.GRID_WIDTH; x++) {
                    const char = row[x];
                    const terrain = level.terrain_legend.find((t: any) => t.symbol === char);
                    if (terrain && terrain.type === "GATE" && terrain.target_id === sourceLevelIdx) {
                        entryX = x; entryY = y;
                    }
                }
            });
        }

        // If no gate found, fallback to '@' in map
        if (entryX === -1) {
            level.map_layout.forEach((row: string, y: number) => {
                const x = row.indexOf('@');
                if (x !== -1) { entryX = x; entryY = y; }
            });
        }

        if (entryX !== -1) {
            console.log(`[SYS] Teleporting player to entry: ${entryX}, ${entryY}`);
            mainProc.run(`${entryX} ${entryY} CMD_TELEPORT`);
            setPlayerPos({ x: entryX, y: entryY });
            setCursorPos({ x: entryX, y: entryY });
        }

        if (level.simulation_mode === "PLATFORM") {
            switchMode("PLATFORM");
        } else {
            switchMode("GRID");
            mainProc.run("REDRAW_ALL");
        }
        return;
    }
    console.log(`[SYS] Initializing level: ${level.id}`);

    addLog(`Initializing ${level.name}...`);
    if (level.simulation_mode === 'PLATFORM') {
        mainProc.run("INIT_PLATFORMER");
    } else {
        mainProc.run("INIT_MAP");
    }
    if (!playerProc.isWordDefined("PLAYER_INITIALIZED")) {
        playerProc.run("INIT_PLAYER : PLAYER_INITIALIZED ;");
    }

    if (lIdx !== -1) {
        mainProc.run(`${lIdx} SET_LEVEL_ID`);
    }

    // Boot level kernels
    hiveProc.run("INIT_HIVE");
    battleProc.run("INIT_BATTLE");

    // [INIT-SYNC] Run broker to process channel subscriptions BEFORE spawning entities
    // This ensures Hive/Battle kernels are ready to receive spawn events.
    runBroker([mainProc, hiveProc, battleProc, playerProc], lIdx);

    level.map_layout.forEach((row: string, y: number) => {
      if (y >= MEMORY.GRID_HEIGHT) return;
      for (let x = 0; x < MEMORY.GRID_WIDTH; x++) {
        const char = row[x] || ' ';
        let color = 0x888888;
        let type = 0;
        let charCode = char.charCodeAt(0);

        const isPortalPart = char === '[' || char === ']' || char === 'R' || char === 'P' || char === 'U' || char === '>' || char === 'X';
        const terrain = level.terrain_legend.find((t: any) => t.symbol === char);
        if (terrain) {
          color = terrain.color;
          type = terrain.passable ? 0 : 1;
        } else if (char === '@' || isPortalPart) {
           type = 0; // Passable
           if (char === '@') {
             charCode = '.'.charCodeAt(0);
             color = 0x444444;
           }
        }
        if (!terrain && char !== '@' && char !== ' ' && !isPortalPart) {
           type = 1;
        }

        const targetId = terrain?.target_id !== undefined ? terrain.target_id : -1;
        mainProc.run(`${x} ${y} ${color} ${charCode} ${type} ${targetId} LOAD_TILE`);
      }
    });

    let player_px_host = 5, player_py_host = 5;
    let foundEntry = false;

    if (sourceLevelIdx !== -1) {
        level.map_layout.forEach((row: string, y: number) => {
            for (let x = 0; x < MEMORY.GRID_WIDTH; x++) {
                const char = row[x];
                const terrain = level.terrain_legend.find((t: any) => t.symbol === char);
                if (terrain && terrain.type === "GATE" && terrain.target_id === sourceLevelIdx) {
                    player_px_host = x; player_py_host = y;
                    foundEntry = true;
                }
            }
        });
    }

    if (!foundEntry) {
        level.map_layout.forEach((row: string, y: number) => {
            const x = row.indexOf('@');
            if (x !== -1) { player_px_host = x; player_py_host = y; }
        });
    }

    addLog(`Spawning Player at ${player_px_host},${player_py_host}`);
    setPlayerPos({x: player_px_host, y: player_py_host});
    setCursorPos({x: player_px_host, y: player_py_host});
    mainProc.run(`${player_px_host} ${player_py_host} 65535 64 0 SPAWN_ENTITY`);

    level.entities.forEach((ent: any) => {
        const c = ent.glyph.color || 0xFF0000;
        const ch = ent.glyph.char.charCodeAt(0);

        let aiType = 1;
        if (ent.glyph.char === '$') aiType = 3;
        else if (ent.scripts && ent.scripts.passive && ent.scripts.passive.includes('aggressive')) aiType = 2;
        else if (ent.id.includes("giant")) aiType = 2;

        mainProc.run(`${ent.x} ${ent.y} ${c} ${ch} ${aiType} SPAWN_ENTITY`);
    });

    // Final broker run to deliver spawn events to Hive/Battle
    runBroker([mainProc, hiveProc, battleProc, playerProc], lIdx);

    // Immediately process inboxes so kernels are initialized before first render
    mainProc.run("PROCESS_INBOX");
    hiveProc.run("PROCESS_INBOX");
    battleProc.run("PROCESS_INBOX");
    playerProc.run("PROCESS_INBOX");

    if (level.platformer_config) {
        platformerRef.current.configure(level.platformer_config);
    }

    initializedLevels.current.add(level.id);

    if (level.simulation_mode === "PLATFORM") {
        switchMode("PLATFORM");
    } else {
        switchMode("GRID");
    }

    // Sync state immediately after level load
    setTimeout(syncKernelState, 50);
  };

  const handleLevelTransition = async (targetLevelIdx: number) => {
      if (!worldInfo || !worldInfo.levels) return;

      const sourceIdx = currentLevelIdx;
      const targetId = LEVEL_IDS[targetLevelIdx];
      const nextLevel = worldInfo.levels[targetId];

      if (nextLevel) {
          console.log(`[HOST] Transitioning from ${sourceIdx} to ${targetId} (index ${targetLevelIdx})`);
          addLog(`Transitioning to ${nextLevel.name}...`);
          setCurrentLevelId(targetId);
          // Update active_level in worldInfo for UI components
          setWorldInfo({
              ...worldInfo,
              active_level: nextLevel
          });
          await loadLevel(nextLevel, sourceIdx);
      }
  };

  const handleGenerate = async (e: React.MouseEvent) => {
    setMode("GENERATING");
    try {
      let data: WorldData;
      if (e.shiftKey) {
          addLog(`[DEBUG] MOCK PROTOCOL ENGAGED.`);
          await new Promise(r => setTimeout(r, 500));
          data = generatorService.generateMockWorld();
      } else {
          if (!seed) return;
          addLog(`Contacting AI... Seed: "${seed}"`);
          data = await generatorService.generateWorld(seed);
      }
      setWorldInfo(data);
      addLog(`World Generated: ${data.theme.name}`);
      
      addLog("Simulation Initializing...");
      setCurrentLevelId(data.active_level.id);
      await loadLevel(data.active_level);
      addLog("Simulation Ready.");

      // Initial Sync
      setTimeout(syncKernelState, 100);

    } catch (e) {
      addLog(`Error: ${e}`);
      console.error(e);
      setMode("BOOT");
    }
  };

  const [saveExists, setSaveExists] = useState(false);

  useEffect(() => {
      storageService.exists("AETHERGARD_SAVE").then(setSaveExists);
  }, []);

  const saveGame = async () => {
    if (!worldInfo) return;
    const gameState = {
        worldInfo,
        currentLevelId,
        forthState: forthService.serializeAll()
    };
    try {
        await storageService.save("AETHERGARD_SAVE", gameState);
        setSaveExists(true);
        addLog("GAME SAVED TO INDEXEDDB.");
    } catch (e) {
        console.error("Save failed:", e);
        addLog("SAVE FAILED.");
    }
  };

  const loadGame = async () => {
    setMode("GENERATING");
    try {
        const gameState = await storageService.load("AETHERGARD_SAVE");
        if (!gameState) {
            addLog("NO SAVE DATA FOUND.");
            setMode("BOOT");
            return;
        }
        setWorldInfo(gameState.worldInfo);
        setCurrentLevelId(gameState.currentLevelId);

        await forthService.deserializeAll(gameState.forthState);

        // Reconstruct initializedLevels set based on restored processes
        initializedLevels.current = new Set();
        Object.values(gameState.forthState.processes).forEach((p: any) => {
            const lId = LEVEL_IDS[p.levelIdx];
            if (lId) initializedLevels.current.add(lId);
        });

        addLog("GAME LOADED SUCCESSFULLY.");

        const currentLevel = gameState.worldInfo.levels[gameState.currentLevelId];
        if (currentLevel?.simulation_mode === "PLATFORM") {
            setMode("PLATFORM");
        } else {
            setMode("GRID");
        }
    } catch (e) {
        console.error("Load failed:", e);
        addLog("LOAD FAILED: Corrupt data?");
        setMode("BOOT");
    }
  };

  const switchMode = (newMode: GameMode) => {
    setMode(newMode);
    if (newMode === "PLATFORM") {
      platformerRef.current.x = 2;
      platformerRef.current.y = 10;
    }
  };

  // Hibernation Maintenance Effect
  useEffect(() => {
      if (mode === "GRID" || mode === "PLATFORM") {
          forthService.maintenance(currentLevelIdx);
      }
  }, [currentLevelIdx, loadedKernelIds]);

  const runBroker = (kernels: any[], levelIdx: number) => {
      const inboxes = new Map<number, number[]>();
      kernels.forEach(k => {
          const instId = k.id === "PLAYER" ? 2 : parseInt(k.id);
          inboxes.set(instId, []);
      });

      kernels.forEach(k => {
          const outMem = new Int32Array(k.getMemory(), MEMORY.OUTPUT_QUEUE_ADDR, 1024);
          const count = outMem[0];

          if (count > 0) {
              const kInstId = k.id === "PLAYER" ? 2 : parseInt(k.id);
              let offset = 1;
              while (offset < count + 1) {
                  const header = outMem.subarray(offset, offset + PACKET_SIZE_INTS);
                  const op = header[0];
                  const senderRole = header[1];
                  const targetRole = header[2];

                  let packetLen = PACKET_SIZE_INTS;
                  if (op === Opcode.SYS_BLOB) {
                      packetLen += header[3];
                  }

                  const packet = outMem.subarray(offset, offset + packetLen);
                  forthService.logPacket(senderRole, targetRole, op, header[3], header[4], header[5]);
                  console.log(`[BROKER] Op:${op} SenderRole:${senderRole} TargetRole:${targetRole} P1:${header[3]}`);

                  if (targetRole === KernelID.HOST) {
                      if (op === Opcode.EVT_DEATH && header[3] === 0) setGameOver(true);
                      if (op === Opcode.EVT_MOVED && header[3] === 0) setPlayerPos({ x: header[4], y: header[5] });
                      if (op === Opcode.EVT_LEVEL_TRANSITION) handleLevelTransition(header[3]);
                  } else if (targetRole === KernelID.BUS) {
                      for (const [instId, inbox] of inboxes.entries()) {
                          if (instId !== kInstId) inbox.push(...packet);
                      }
                  } else if (targetRole >= 1000) {
                      channelSubscriptions.current.get(targetRole)?.forEach(subInstId => {
                          if (subInstId !== kInstId) inboxes.get(subInstId)?.push(...packet);
                      });
                  } else {
                      const targetInstId = getInstanceID(targetRole, levelIdx);
                      inboxes.get(targetInstId)?.push(...packet);
                  }

                  if (op === Opcode.SYS_CHAN_SUB) {
                      const chanId = header[3];
                      if (!channelSubscriptions.current.has(chanId)) channelSubscriptions.current.set(chanId, new Set());
                      channelSubscriptions.current.get(chanId)!.add(kInstId);
                  } else if (op === Opcode.SYS_CHAN_UNSUB) {
                      channelSubscriptions.current.get(header[3])?.delete(kInstId);
                  }

                  offset += packetLen;
              }
              outMem[0] = 0;
          }
      });

      kernels.forEach(k => {
          const instId = k.id === "PLAYER" ? 2 : parseInt(k.id);
          const data = inboxes.get(instId);
          if (data && data.length > 0) {
              const inMem = new Int32Array(k.getMemory(), MEMORY.INPUT_QUEUE_ADDR, 1024);
              const currentCount = inMem[0];
              if (currentCount + data.length < 1024) {
                  inMem[0] = currentCount + data.length;
                  inMem.set(data, currentCount + 1);
              }
          }
      });
  };

  const tickSimulation = () => {
      const lIdx = currentLevelIdx;
      const gridId = String(getInstanceID(KernelID.GRID, lIdx));
      const hiveId = String(getInstanceID(KernelID.HIVE, lIdx));
      const battleId = String(getInstanceID(KernelID.BATTLE, lIdx));

      const main = forthService.get(gridId);
      const hive = forthService.get(hiveId);
      const player = forthService.get("PLAYER");
      const battle = forthService.get(battleId);

      if (!main?.isReady || !player?.isReady) return;

      const activeKernelsList: any[] = [main, player];
      if (hive?.isReady) activeKernelsList.push(hive);
      if (battle?.isReady) activeKernelsList.push(battle);

      // --- TURN-BASED CHAIN REACTION (Flush message queues) ---
      
      // 1. Deliver move requests from last turn/input
      runBroker(activeKernelsList, lIdx);
      activeKernelsList.forEach(k => k.run("PROCESS_INBOX"));

      // 2. AI decides actions
      if (hive?.isReady) hive.run("RUN_HIVE_CYCLE");
      main.run("RUN_ENV_CYCLE");

      // 3. Deliver AI actions and physics collisions
      runBroker(activeKernelsList, lIdx);
      activeKernelsList.forEach(k => k.run("PROCESS_INBOX"));

      // 4. Deliver combat triggers (Attack commands)
      runBroker(activeKernelsList, lIdx);
      activeKernelsList.forEach(k => k.run("PROCESS_INBOX"));

      // 5. Deliver final results (Damage events, Deaths)
      runBroker(activeKernelsList, lIdx);
      activeKernelsList.forEach(k => k.run("PROCESS_INBOX"));

      syncKernelState();
      
      if (inspectStats) handleInspect(inspectStats.x, inspectStats.y);
  };

  const syncKernelState = () => {
      const playerProc = forthService.get("PLAYER");
      const gridId = String(getInstanceID(KernelID.GRID, currentLevelIdx));
      const gridProc = forthService.get(gridId);
      if (!playerProc?.isReady || !gridProc?.isReady) return;

      // 1. Sync Player Stats (0xA0000 in Battle Kernel for real-time stats, fallback to 0xC0000 in Player Kernel)
      const battleId = String(getInstanceID(KernelID.BATTLE, currentLevelIdx));
      const battleProc = forthService.get(battleId);

      let hp = 0, maxHp = 0, gold = 0, inv = 0;

      if (battleProc?.isReady) {
          const bMem = new DataView(battleProc.getMemory());
          hp = bMem.getInt32(0xA0000, true);
          maxHp = bMem.getInt32(0xA0004, true);
      }

      const pMem = new DataView(playerProc.getMemory());
      gold = pMem.getInt32(0xC0008, true);
      inv = pMem.getInt32(0xC000C, true);

      // Fallback for HP if Battle Kernel not ready or uninitialized
      if (hp === 0 && maxHp === 0) {
          hp = pMem.getInt32(0xC0000, true);
          maxHp = pMem.getInt32(0xC0004, true);
      }

      setPlayerStats({ hp, maxHp, gold, inv });

      // 2. Sync Ground Items at Player Position
      const gMemView = new DataView(gridProc.getMemory());
      const player_px_host = gMemView.getInt32(0x90000 + 12, true); // Entity 0 is Player
      const player_py_host = gMemView.getInt32(0x90000 + 8, true);

      const idx = player_py_host * MEMORY.GRID_WIDTH + player_px_host;
      const lootVal = new Uint8Array(gridProc.getMemory())[0x32000 + idx]; // LOOT_MAP

      if (lootVal > 0) {
          const lootId = lootVal - 1;
          const char = gMemView.getInt32(0x90000 + (lootId * 20), true);
          let name = `Item (${String.fromCharCode(char)})`;
          if (char === 82) name = "Corpse of Big Rat";
          if (char === 114) name = "Corpse of Rat";
          if (char === 36) name = "Gold Coin";
          setGroundItems([name]);
      } else {
          setGroundItems([]);
      }

      // 3. Update Inspector if active
      if (inspectStats) {
          handleInspect(inspectStats.x, inspectStats.y);
      }
  };

  // Inspect Entity at X, Y by checking Kernel Memory directly
  // Returns the ID found, or -1
  const getEntityAt = (x: number, y: number): number => {
      const gridId = String(getInstanceID(KernelID.GRID, currentLevelIdx));
      const gridProc = forthService.get(gridId);
      if (!gridProc?.isReady) return -1;
      const gridMem = new Uint8Array(gridProc.getMemory());
      const ENTITY_MAP_ADDR = 0x31000;
      const idx = y * MEMORY.GRID_WIDTH + x;
      const val = gridMem[ENTITY_MAP_ADDR + idx];
      return val === 0 ? -1 : val - 1;
  };

  const isWallAt = (x: number, y: number): boolean => {
      const gridId = String(getInstanceID(KernelID.GRID, currentLevelIdx));
      const gridProc = forthService.get(gridId);
      if (!gridProc?.isReady) return false;
      const gridMem = new Uint8Array(gridProc.getMemory());
      const COLLISION_MAP_ADDR = 0x30000;
      const ENTITY_MAP_ADDR = 0x31000;
      const idx = y * MEMORY.GRID_WIDTH + x;
      // Wall if collision is 1 but no entity is there
      return gridMem[COLLISION_MAP_ADDR + idx] === 1 && gridMem[ENTITY_MAP_ADDR + idx] === 0;
  };

  const handleInspect = (x: number, y: number) => {
      const foundId = getEntityAt(x, y);

      if (foundId !== -1) {
          const battleId = String(getInstanceID(KernelID.BATTLE, currentLevelIdx));
          const battleProc = forthService.get(battleId);
          if (!battleProc?.isReady) return;
          const battleMem = new DataView(battleProc.getMemory());
          const RPG_TABLE_ADDR = 0xA0000; 
          const RPG_ENT_SIZE = 32; 
          const base = RPG_TABLE_ADDR + (foundId * RPG_ENT_SIZE);
          
          const hp = battleMem.getInt32(base, true);
          const maxHp = battleMem.getInt32(base + 4, true);
          const atk = battleMem.getInt32(base + 8, true);
          const def = battleMem.getInt32(base + 12, true);
          const state = battleMem.getInt32(base + 24, true);

          setInspectStats({
              id: foundId,
              x, y,
              hp, maxHp, atk, def, state
          });
      } else {
          setInspectStats(null);
      }
  };

  const animate = (time: number) => {
    if (viewMode === "ARCHITECT") return;

    if (mode === "GRID") {
      const gridId = String(getInstanceID(KernelID.GRID, currentLevelIdx));
      const mainProc = forthService.get(gridId);
      if (mainProc && mainProc.isReady) {
         try {
             const raw = mainProc.getMemory() as ArrayBuffer;
             const vramSize = MEMORY.GRID_WIDTH * MEMORY.GRID_HEIGHT * 4;
             if (raw.byteLength >= MEMORY.VRAM_ADDR + vramSize) {
                 const vramSlice = raw.slice(MEMORY.VRAM_ADDR, MEMORY.VRAM_ADDR + vramSize);
                 setDisplayBuffer(vramSlice);
             }
         } catch (e) { console.error(e); }
       }
    } 
    else if (mode === "PLATFORM") {
      const gridId = String(getInstanceID(KernelID.GRID, currentLevelIdx));
      const platProc = forthService.get(gridId);
      if (platProc && platProc.isReady) {
          if (keysDownRef.current.has("ArrowLeft")) platProc.run("-1 CMD_MOVE");
          if (keysDownRef.current.has("ArrowRight")) platProc.run("1 CMD_MOVE");

          try {
              platProc.run("RUN_PLATFORM_CYCLE");
              const raw = platProc.getMemory() as ArrayBuffer;
              const vramSize = MEMORY.GRID_WIDTH * MEMORY.GRID_HEIGHT * 4;
              if (raw.byteLength >= MEMORY.VRAM_ADDR + vramSize) {
                  const vramSlice = raw.slice(MEMORY.VRAM_ADDR, MEMORY.VRAM_ADDR + vramSize);
                  setDisplayBuffer(vramSlice);
              }
          } catch (e) { console.error(e); }
      }

      if (time - lastTickTimeRef.current > SIMULATION_TICK_RATE_MS) {
          tickSimulation();
          lastTickTimeRef.current = time;
      }
    }
    
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (viewMode === "GAME") {
        requestRef.current = requestAnimationFrame(animate);
    } else {
        cancelAnimationFrame(requestRef.current!);
    }
    return () => cancelAnimationFrame(requestRef.current!);
  }, [mode, viewMode]);

  const triggerPickup = () => {
        const playerProc = forthService.get("PLAYER");
        if (playerProc && playerProc.isReady) {
            // CMD_PICKUP [PlayerID, PlayerX, PlayerY]
            const cmd = `0 OUT_PTR ! 305 2 1 0 ${playerPos.x} ${playerPos.y} BUS_SEND`;
            playerProc.run(cmd);
            tickSimulation();
        }
  };

  useEffect(() => {
    const handleKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
        const k = e.key;
        keysDownRef.current.add(k);

        if (mode === "PLATFORM") {
            const gridId = String(getInstanceID(KernelID.GRID, currentLevelIdx));
            const platProc = forthService.get(gridId);
            if (platProc.isReady) {
                if (k === "ArrowUp") platProc.run("CMD_JUMP");
                if (k === "Escape") switchMode("GRID");
            }
            return;
        }

        if (mode !== "GRID") return;
        
        // Prevent default browser behavior for gameplay keys
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k)) {
            e.preventDefault();
        }

        // --- TARGET MODE INPUT ---
        if (targetMode) {
            if (k === "Escape") {
                setTargetMode(false);
                setSelectedSkill(null);
                setIsValidTarget(true);
                return;
            }
            
            // Allow Skill Switching inside Target Mode
            if (['1', '2', '3', '4'].includes(k)) {
                const skill = PLAYER_SKILLS.find(s => s.key === k);
                if (skill) {
                    setSelectedSkill(skill);
                    // Reset cursor to player when switching skills for better UX
                    setCursorPos({...playerPos});
                    // Only HEAL is valid on self (ID 0)
                    setIsValidTarget(skill.name === "HEAL");
                    addLog(`[TARGETING] Switched to ${skill.name} (Range: ${skill.range})`);
                }
                return;
            }
            
            let cx = cursorPos.x;
            let cy = cursorPos.y;
            if (k === "ArrowUp") cy--;
            if (k === "ArrowDown") cy++;
            if (k === "ArrowLeft") cx--;
            if (k === "ArrowRight") cx++;
            
            // Bounds Check
            if (cx < 0) cx = 0; if (cy < 0) cy = 0;
            if (cx >= MEMORY.GRID_WIDTH) cx = MEMORY.GRID_WIDTH - 1;
            if (cy >= MEMORY.GRID_HEIGHT) cy = MEMORY.GRID_HEIGHT - 1;
            
            // Wall Check: Block cursor from entering walls
            if (isWallAt(cx, cy)) {
                cx = cursorPos.x;
                cy = cursorPos.y;
            }

            // Range Check & Block movement outside range
            if (selectedSkill) {
                const dist = Math.abs(cx - playerPos.x) + Math.abs(cy - playerPos.y);
                if (dist <= selectedSkill.range) {
                    setCursorPos({x: cx, y: cy});

                    // Validate target: Attack skills cannot target self (ID 0)
                    if (selectedSkill.name !== "HEAL" && cx === playerPos.x && cy === playerPos.y) {
                        setIsValidTarget(false);
                    } else {
                        setIsValidTarget(true);
                    }
                }
            } else {
                setCursorPos({x: cx, y: cy});
            }

            if (k === "Enter" && selectedSkill) {
                if (!isValidTarget) {
                    addLog("INVALID TARGET OR OUT OF RANGE!");
                    return;
                }
                const targetId = getEntityAt(cursorPos.x, cursorPos.y);
                if (targetId !== -1) {
                    // Final safety: Cannot attack self
                    if (selectedSkill.name !== "HEAL" && targetId === 0) {
                        addLog("CANNOT ATTACK SELF!");
                        return;
                    }

                    addLog(`Executing ${selectedSkill.name} on ID ${targetId}`);
                    const playerProc = forthService.get("PLAYER");
                    if (playerProc && playerProc.isReady) {
                        // Send Attack Command to Bus
                        // P1=Source(0), P2=Target(targetId), P3=SkillID
                        const cmd = `0 OUT_PTR ! 303 2 255 0 ${targetId} ${selectedSkill.id} BUS_SEND`;
                        playerProc.run(cmd);
                        tickSimulation();
                        setTargetMode(false);
                        setSelectedSkill(null);
                    }
                } else {
                    addLog("No Target Selected.");
                }
            }
            return;
        }

        // --- NORMAL MODE INPUT ---
        let dx = 0;
        let dy = 0;
        
        if (k === "ArrowUp") dy = -1;
        if (k === "ArrowDown") dy = 1;
        if (k === "ArrowLeft") dx = -1;
        if (k === "ArrowRight") dx = 1;
        
        // Skill Shortcuts (1-4)
        if (['1', '2', '3', '4'].includes(k)) {
            if (currentLevelId === "hub") return;
            const skill = PLAYER_SKILLS.find(s => s.key === k);
            if (skill) {
                // All skills now use Targeting Mode for consistency
                setSelectedSkill(skill);
                setTargetMode(true);
                setCursorPos({...playerPos}); // Reset cursor to player

                // Only HEAL is valid on self (ID 0)
                setIsValidTarget(skill.name === "HEAL");

                // Special log for HEAL
                if (skill.name === "HEAL") {
                    addLog(`[TARGETING] Select target for HEAL (Self). Press ENTER.`);
                } else {
                    addLog(`[TARGETING] Select target for ${skill.name} (Range: ${skill.range})...`);
                }
            }
            return;
        }

        if (dx !== 0 || dy !== 0) {
            const playerProc = forthService.get("PLAYER");
            if (playerProc && playerProc.isReady) {
                // Send Move Request
                const cmd = `0 OUT_PTR ! 101 2 1 0 ${dx} ${dy} BUS_SEND`;
                playerProc.run(cmd);
                tickSimulation();
            }
        }
        
        if (k === " ") {
            // Spacebar = Interact/Heavy Smash Shortcut (Legacy)
             const playerProc = forthService.get("PLAYER");
            if (playerProc && playerProc.isReady) {
                const cmd = `0 OUT_PTR ! 301 2 2 0 0 0 BUS_SEND`;
                playerProc.run(cmd);
                tickSimulation();
            }
        }
        
        if (k === "g" || k === "G") {
            triggerPickup();
        }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        keysDownRef.current.delete(e.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
    };
  }, [mode, targetMode, cursorPos, selectedSkill, isValidTarget, playerPos, currentLevelId]);

  return (
    <div style={{ backgroundColor: "#111", color: "#0f0", fontFamily: "Courier New", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      
      {/* BUS LOG SIDEBAR - RIGHT SIDE */}
      <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: '350px',
          backgroundColor: 'rgba(0, 10, 0, 0.95)',
          borderLeft: '2px solid #0f0',
          transform: showBus ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          zIndex: 10000,
          display: 'flex', flexDirection: 'column'
      }}>
          <div style={{ padding: '10px', background: '#020', borderBottom: '1px solid #0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setShowBus(false)} style={{ background: 'transparent', border: 'none', color: '#0f0', cursor: 'pointer' }}>[X]</button>
              <span>KERNEL BUS MONITOR</span>
          </div>
          
          <div style={{ padding: '10px', borderBottom: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                  <select
                      value={busFilterCategory}
                      onChange={(e) => {
                          setBusFilterCategory(e.target.value as any);
                          setBusFilterValue("");
                      }}
                      style={{ flex: 1, background: '#000', color: '#0f0', border: '1px solid #0f0', fontSize: '0.8em', padding: '2px' }}
                  >
                      <option value="ALL">ALL EVENTS</option>
                      <option value="BUS">BUS ONLY</option>
                      <option value="KERNEL">KERNELS</option>
                      <option value="CHANNEL">CHANNELS</option>
                  </select>

                  {busFilterCategory === 'KERNEL' && (
                      <select
                          value={busFilterValue}
                          onChange={(e) => setBusFilterValue(e.target.value)}
                          style={{ flex: 1, background: '#000', color: '#0f0', border: '1px solid #0f0', fontSize: '0.8em', padding: '2px' }}
                      >
                          <option value="">(ALL KERNELS)</option>
                          {Object.keys(KernelID).filter(k => isNaN(Number(k)) && k !== 'BUS').map(k => (
                              <option key={k} value={k}>{k}</option>
                          ))}
                      </select>
                  )}

                  {busFilterCategory === 'CHANNEL' && (
                      <select
                          value={busFilterValue}
                          onChange={(e) => setBusFilterValue(e.target.value)}
                          style={{ flex: 1, background: '#000', color: '#0f0', border: '1px solid #0f0', fontSize: '0.8em', padding: '2px' }}
                      >
                          <option value="">(ALL CHANNELS)</option>
                          {Array.from(forthService.channelNames.entries()).map(([id, name]) => (
                              <option key={id} value={name}>{name} ({id})</option>
                          ))}
                      </select>
                  )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.8em' }}>
                  <input 
                      type="checkbox" 
                      checked={filterMovement} 
                      onChange={(e) => setFilterMovement(e.target.checked)} 
                      style={{ marginRight: '10px' }}
                  />
                  HIDE MOVEMENT/PHYSICS
              </label>
          </div>

          {/* ACTIVE KERNELS SECTION */}
          <div style={{ padding: '10px', borderBottom: '1px solid #333', maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)' }}>
              <div style={{ color: '#aaa', fontSize: '0.7em', marginBottom: '5px', letterSpacing: '1px' }}>ACTIVE KERNEL INSTANCES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {loadedKernelIds.map(id => {
                    const proc = forthService.get(id);
                    const roleId = id === "PLAYER" ? KernelID.PLAYER : getRoleID(parseInt(id));
                    const roleName = KernelID[roleId] || "UNKNOWN";
                    const isCurrent = id === "PLAYER" || proc.levelIdx === currentLevelIdx;

                    const statusColor = proc.status === "ACTIVE" ? (isCurrent ? "#0f0" : "#0a0") :
                                      proc.status === "PAUSED" ? "#aa0" : "#555";

                    return (
                        <div key={id} style={{
                            fontSize: '10px',
                            color: statusColor,
                            display: 'flex',
                            justifyContent: 'space-between',
                            background: isCurrent ? 'rgba(0, 255, 0, 0.05)' : 'transparent',
                            padding: '2px 4px',
                            borderLeft: isCurrent ? '2px solid #0f0' : (proc.status === "FLASHED" ? '2px solid #333' : '2px solid transparent')
                        }}>
                            <span style={{ fontWeight: isCurrent ? 'bold' : 'normal' }}>
                                {roleName} {proc.status === "FLASHED" && "[F]"}
                            </span>
                            <span style={{ opacity: 0.7 }}>ID:{id} | LVL:{proc.levelIdx}</span>
                        </div>
                    );
                })}
              </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', fontSize: '11px', fontFamily: 'monospace' }}>
              {busHistory.map((p, i) => (
                  <div key={i} style={{ marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
                      <div style={{ color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{p.timestamp}</span>
                          <span style={{ color: '#444' }}>OP:{p.opcode}</span>
                      </div>
                      <div>
                        <span style={{color: '#0af'}}>{p.sender}</span>
                        <span style={{color: '#666'}}> &gt; </span>
                        <span style={{color: p.targetId >= 1000 ? '#f0f' : '#fa0'}}>{p.target}</span>
                      </div>
                      <div style={{ color: 'white', fontWeight: 'bold', marginTop: '2px' }}>{p.op}</div>
                      <div style={{ color: '#888', background: 'rgba(255,255,255,0.05)', padding: '2px 4px', borderRadius: '2px', marginTop: '2px' }}>{p.payload}</div>
                  </div>
              ))}
          </div>
      </div>

      {/* HEADER */}
      <div style={{ flex: "0 0 40px", padding: "10px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#000" }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>AI ROGUELIKE v2.1 [INVENTORY]</span>
        </div>
        {worldInfo && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={saveGame} style={{ background: "#222", color: "#0f0", border: "1px solid #0f0", padding: "5px 10px", cursor: "pointer", fontSize: '0.8em' }}>SAVE</button>
            <button onClick={() => setViewMode("GAME")} style={{ background: viewMode === "GAME" ? "#0f0" : "#222", color: viewMode === "GAME" ? "#000" : "#0f0", border: "1px solid #0f0", padding: "5px 15px", cursor: "pointer" }}>SIMULATION</button>
            <button onClick={() => setViewMode("ARCHITECT")} style={{ background: viewMode === "ARCHITECT" ? "#f0f" : "#222", color: viewMode === "ARCHITECT" ? "#000" : "#f0f", border: "1px solid #f0f", padding: "5px 15px", cursor: "pointer" }}>ARCHITECT</button>
          </div>
        )}
        <span style={{ color: mode === "GRID" ? "cyan" : "orange" }}>STATUS: {mode}</span>
      </div>

      <div style={{ flex: "1 1 auto", position: "relative", display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
        
        {/* BOOT MODE */}
        {mode === "BOOT" && (
          <div style={{ textAlign: "center", overflowY: 'auto', maxHeight: '100%' }}>
            <h1>WORLD SEED INPUT</h1>
            <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ background: "#000", border: "1px solid #0f0", color: "#0f0", padding: "10px", fontSize: "1.2em", width: "300px", textAlign: "center" }} />
            <br /><br />
            <div style={{ color: "#666", marginBottom: "10px" }}>Tip: Shift+Click for Instant Mock World</div>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                <button onClick={handleGenerate} style={{ background: "#0f0", color: "#000", border: "none", padding: "10px 20px", fontSize: "1.2em", cursor: "pointer" }}>INITIATE GENERATION</button>
                {saveExists && (
                    <button onClick={loadGame} style={{ background: "#00f", color: "#fff", border: "none", padding: "10px 20px", fontSize: "1.2em", cursor: "pointer" }}>LOAD LAST SESSION</button>
                )}
            </div>

            <AIConfig />
          </div>
        )}

        {/* LOADING MODE */}
        {mode === "GENERATING" && <div style={{ textAlign: "center" }}><h1>SYNCING KERNELS...</h1></div>}

        {/* VIEW MODES */}
        {viewMode === "ARCHITECT" && worldInfo && <ArchitectView data={worldInfo} />}

        {/* GAME OVER OVERLAY */}
        {gameOver && (
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(50, 0, 0, 0.8)',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                zIndex: 10000, color: 'white', textShadow: '2px 2px 4px #000'
            }}>
                <h1 style={{ fontSize: '4em', margin: 0 }}>GAME OVER</h1>
                <button
                    onClick={() => {
                        setGameOver(false);
                        setMode("BOOT");
                        setLog([]);
                    }}
                    style={{
                        marginTop: '20px', padding: '15px 30px', fontSize: '1.5em',
                        backgroundColor: 'red', color: 'white', border: 'none', cursor: 'pointer',
                        boxShadow: '0 0 10px rgba(255,0,0,0.5)'
                    }}
                >
                    RESTART SIMULATION
                </button>
            </div>
        )}

        {viewMode === "GAME" && (mode === "GRID" || mode === "PLATFORM") && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            
            {/* HUD PANEL - LEFT SIDE */}
            <div style={{
                position: 'absolute', top: 0, left: '-220px', width: '200px',
                background: 'rgba(0, 20, 0, 0.9)', border: '1px solid #0f0',
                padding: '10px', fontFamily: 'monospace', fontSize: '0.8em', zIndex: 20
            }}>
                <div style={{ borderBottom: '1px solid #333', marginBottom: '8px', color: '#fff' }}>PLAYER HUD</div>
                <div style={{ marginBottom: '4px' }}>HP: <span style={{ color: playerStats.hp < 30 ? 'red' : '#0f0' }}>{playerStats.hp}/{playerStats.maxHp}</span></div>
                <div style={{ marginBottom: '4px' }}>GOLD: <span style={{ color: 'gold' }}>{playerStats.gold}</span></div>
                <div style={{ marginBottom: '4px' }}>INV: <span style={{ color: 'cyan' }}>{playerStats.inv}/10</span></div>

                <div style={{ borderBottom: '1px solid #333', marginTop: '15px', marginBottom: '8px', color: '#fff' }}>ON GROUND</div>
                {groundItems.length > 0 ? groundItems.map((it, i) => (
                    <div key={i} style={{ color: '#aaa' }}>{it}</div>
                )) : <div style={{ color: '#444' }}>Empty</div>}
            </div>

            {/* INSPECTOR OVERLAY */}
            {inspectStats && (
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
                    <div style={{borderBottom: "1px solid #333", marginBottom: "5px", color: "#fff"}}>ENTITY INSPECTOR</div>
                    <div>ID: <span style={{color:"cyan"}}>{inspectStats.id}</span></div>
                    <div>LOC: {inspectStats.x}, {inspectStats.y}</div>
                    <div style={{marginTop: "5px", color: "#aaa"}}>STATS</div>
                    <div>HP:  <span style={{color: inspectStats.hp < 10 ? "red" : "#0f0"}}>{inspectStats.hp}</span> / {inspectStats.maxHp}</div>
                    <div>ATK: {inspectStats.atk}</div>
                    <div>DEF: {inspectStats.def}</div>
                    <div>STATE: {inspectStats.state === 1 ? "DEAD" : "ALIVE"}</div>
                    <button onClick={() => setInspectStats(null)} style={{marginTop: "10px", width: "100%", background: "#222", color: "#fff", border: "1px solid #555", cursor: "pointer"}}>CLOSE</button>
                </div>
            )}

            <div style={{ border: "1px solid #333" }}>
              <TerminalCanvas 
                memoryBuffer={displayBuffer} 
                width={MEMORY.GRID_WIDTH} 
                height={MEMORY.GRID_HEIGHT} 
                onGridClick={handleInspect}
                cursor={(targetMode && !(selectedSkill?.name === "HEAL" && cursorPos.x === playerPos.x && cursorPos.y === playerPos.y)) ? cursorPos : null}
              />
              {/* Overlay for Invalid Target */}
              {targetMode && !isValidTarget && (
                  <div style={{
                      position: 'absolute', left: 0, right: 0, textAlign: 'center', 
                      color: 'red', fontWeight: 'bold', background: 'rgba(0,0,0,0.5)', pointerEvents: 'none'
                  }}>
                      {Math.abs(cursorPos.x - playerPos.x) + Math.abs(cursorPos.y - playerPos.y) > (selectedSkill?.range || 0)
                        ? "OUT OF RANGE"
                        : "INVALID TARGET"}
                  </div>
              )}
            </div>

            {/* ACTION BAR */}
            {currentLevelId !== "hub" && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    {PLAYER_SKILLS.map(skill => (
                        <div key={skill.id} style={{
                            border: selectedSkill?.id === skill.id ? '2px solid #fff' : '1px solid #333',
                            background: selectedSkill?.id === skill.id ? '#333' : '#000',
                            padding: '5px 10px',
                            fontSize: '0.8em',
                            color: targetMode && selectedSkill?.id === skill.id ? (isValidTarget ? 'orange' : 'red') : '#aaa'
                        }}>
                            <span style={{color: '#0f0', fontWeight: 'bold'}}>[{skill.key}]</span> {skill.name}
                            <span style={{fontSize: '0.7em', color: '#666', marginLeft: '5px'}}>R:{skill.range}</span>
                        </div>
                    ))}

                    <button
                        onClick={triggerPickup}
                        style={{
                            background: '#002200', border: '1px solid #0f0', color: '#0f0',
                            padding: '5px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.8em'
                        }}
                    >
                        [G] PICKUP
                    </button>
                </div>
            )}

            <div 
                ref={logContainerRef}
                style={{ 
                    marginTop: "10px", 
                    width: "600px", 
                    border: "1px solid #333", 
                    padding: "10px", 
                    height: "120px", 
                    overflowY: "auto", 
                    background: "#000", 
                    fontSize: "0.9em",
                    display: "flex",
                    flexDirection: "column-reverse"
                }}
            >
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                   {worldInfo && <div style={{borderBottom: "1px solid #333", marginBottom: "5px", color: "white"}}>LORE: {worldInfo.theme.name}</div>}
                   <div style={{color: '#aaa', fontSize: '0.8em', marginBottom: '5px'}}>TIP: Use [1-4] to Select Skill. Arrow Keys to Target. ENTER to Fire. 'G' to Get Loot.</div>
                   {[...log].reverse().map((l, i) => { 
                       let color = "#0f0";
                       if (l.includes("ERR") || l.includes("CRITICAL")) color = "#f00";
                       if (l.includes("WARN")) color = "orange";
                       return <div key={i} style={{ color }}>{`${l}`}</div>
                   })}
               </div>
            </div>
          </div>
        )}
      </div>
      
      {/* FLOATING ACTION BUTTONS */}
      <div style={{ position: "absolute", bottom: "10px", right: "10px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
          <button 
              onClick={() => setShowBus(!showBus)}
              style={{
                  background: showBus ? "#0f0" : "#000", 
                  border: "1px solid #0f0", color: showBus ? "#000" : "#0f0",
                  fontFamily: "monospace", cursor: "pointer", zIndex: 999,
                  padding: "5px 10px", boxShadow: "0 0 10px rgba(0, 255, 0, 0.2)"
              }}
          >
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
