
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { forthService, BusPacket } from "./src/services/WaForthService";
import { PlatformerPhysics } from "./src/systems/PlatformerPhysics";
import { TerminalCanvas } from "./src/components/TerminalCanvas";
import { generatorService, WorldData } from "./src/services/GeneratorService";
import { ArchitectView } from "./src/components/ArchitectView";
import { DebuggerConsole } from "./src/components/DebuggerConsole";
import { MEMORY } from "./src/constants/Memory";
import { GRID_KERNEL_BLOCKS } from "./src/kernels/GridKernel";
import { HIVE_KERNEL_BLOCKS } from "./src/kernels/HiveKernel";
import { PLAYER_KERNEL_BLOCKS } from "./src/kernels/PlayerKernel";
import { BATTLE_KERNEL_BLOCKS } from "./src/kernels/BattleKernel";
import { PLATFORM_KERNEL_BLOCKS } from "./src/kernels/PlatformKernel";
import { KernelID, Opcode, PACKET_SIZE_INTS } from "./src/types/Protocol";

type GameMode = "BOOT" | "GENERATING" | "GRID" | "PLATFORM";
type ViewMode = "GAME" | "ARCHITECT";

interface EntityStats {
    id: number;
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    state: number;
    invItem: number;
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

  // Track successful kernel loads to prevent loop execution if load failed
  const [activeKernels, setActiveKernels] = useState<Set<string>>(new Set());

  // Bus Log Sidebar State
  const [showBus, setShowBus] = useState(false);
  const [busHistory, setBusHistory] = useState<BusPacket[]>([]);
  const [filterMovement, setFilterMovement] = useState(true); // Default ON to prevent spam
  
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

  // Increased log size to 100
  const addLog = (msg: string) => setLog(prev => [msg, ...prev].slice(0, 100));

  // Auto-scroll Log
  useEffect(() => {
      if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
  }, [log]);
  
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
  }, [showBus, filterMovement]);

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
      setBusHistory([...hist]);
  };

  // Update Bus history immediately when opening sidebar
  useEffect(() => {
      if (showBus) updateBusHistory();
  }, [showBus, filterMovement]);

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

  const loadKernel = async (id: string, blocks: string[]) => {
      try {
          await forthService.bootProcess(id);
          const proc = forthService.get(id);
          addLog(`${id} Kernel Initialized.`);
          
          for (let i = 0; i < blocks.length; i++) {
              try {
                  proc.run(blocks[i]);
              } catch (e) {
                  console.error(`Error in ${id} Block ${i}:`, e);
                  addLog(`ERR: ${id} Block ${i} Failed`);
              }
          }
          addLog(`${id} Logic Loaded. READY.`);
          setActiveKernels(prev => new Set(prev).add(id));
      } catch (e) {
          console.error(`Failed to load ${id}`, e);
          addLog(`CRITICAL: ${id} Load Aborted.`);
      }
  };

  // Boot ALL Kernels
  useEffect(() => {
    const bootSystem = async () => {
        await loadKernel("GRID", GRID_KERNEL_BLOCKS);
        await loadKernel("HIVE", HIVE_KERNEL_BLOCKS);
        await loadKernel("PLAYER", PLAYER_KERNEL_BLOCKS);
        await loadKernel("BATTLE", BATTLE_KERNEL_BLOCKS);
        await loadKernel("PLATFORM", PLATFORM_KERNEL_BLOCKS);
    };
    bootSystem();
    return () => cancelAnimationFrame(requestRef.current!);
  }, []);

  const loadLevel = (level: any) => {
    const mainProc = forthService.get("GRID");
    const hiveProc = forthService.get("HIVE");
    const playerProc = forthService.get("PLAYER");

    addLog(`Loading Level: ${level.name}...`);
    mainProc.run("INIT_MAP");
    hiveProc.run("INIT_HIVE");
    playerProc.run("INIT_PLAYER");

    const platProc = forthService.get("PLATFORM");
    if (platProc.isReady) {
        platProc.run("INIT_PLATFORMER");
        const levelIdx = ["hub", "rogue_dungeon", "platform_dungeon", "platform_dungeon_2"].indexOf(level.id);
        platProc.run(`${levelIdx} SET_LEVEL`);
    }

    level.map_layout.forEach((row: string, y: number) => {
      if (y >= MEMORY.GRID_HEIGHT) return;
      for (let x = 0; x < MEMORY.GRID_WIDTH; x++) {
        const char = row[x] || ' ';
        let color = 0x888888;
        let type = 0;
        let charCode = char.charCodeAt(0);

        const isPortalPart = char === '[' || char === ']' || char === 'R' || char === 'P';
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

        mainProc.run(`${x} ${y} ${color} ${charCode} ${type} LOAD_TILE`);
        if (platProc.isReady) {
            platProc.run(`${x} ${y} ${color} ${charCode} ${type} LOAD_TILE`);
        }
      }
    });

    let px = 5, py = 5;
    level.map_layout.forEach((row: string, y: number) => {
        const x = row.indexOf('@');
        if (x !== -1) { px = x; py = y; }
    });
    addLog(`Spawning Player at ${px},${py}`);
    setPlayerPos({x: px, y: py});
    setCursorPos({x: px, y: py});
    mainProc.run(`${px} ${py} 65535 64 0 SPAWN_ENTITY`);

    level.entities.forEach((ent: any) => {
        const c = ent.glyph.color || 0xFF0000;
        const ch = ent.glyph.char.charCodeAt(0);

        let aiType = 1;
        if (ent.glyph.char === '$') aiType = 3;
        else if (ent.scripts && ent.scripts.passive && ent.scripts.passive.includes('aggressive')) aiType = 2;
        else if (ent.id.includes("giant")) aiType = 2;

        mainProc.run(`${ent.x} ${ent.y} ${c} ${ch} ${aiType} SPAWN_ENTITY`);
    });

    if (level.platformer_config) {
        platformerRef.current.configure(level.platformer_config);
    }

    if (level.id === "platform_dungeon" || level.id === "platform_dungeon_2") {
        switchMode("PLATFORM");
    } else {
        switchMode("GRID");
    }
  };

  const handleLevelTransition = (targetLevelIdx: number) => {
      if (!worldInfo || !worldInfo.levels) return;

      const levelIds = ["hub", "rogue_dungeon", "platform_dungeon", "platform_dungeon_2"];
      const targetId = levelIds[targetLevelIdx];
      const nextLevel = worldInfo.levels[targetId];

      if (nextLevel) {
          addLog(`Transitioning to ${nextLevel.name}...`);
          setCurrentLevelId(targetId);
          // Update active_level in worldInfo for UI components
          setWorldInfo({
              ...worldInfo,
              active_level: nextLevel
          });
          loadLevel(nextLevel);
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
      
      loadLevel(data.active_level);
      addLog("Simulation Ready.");

    } catch (e) {
      addLog(`Error: ${e}`);
      console.error(e);
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

  const tickSimulation = () => {
      const kernels: { id: number, proc: any }[] = [];

      forthService.processes.forEach((proc, name) => {
          if (proc.isReady) {
              const numericId = KernelID[name as keyof typeof KernelID];
              if (numericId !== undefined) {
                  kernels.push({ id: numericId, proc });
              }
          }
      });

      if (kernels.length === 0) return;

      const runBroker = () => {
          const inboxes = new Map<number, number[]>();

          // Initialize inboxes for all known kernels + BUS
          Object.values(KernelID).forEach(v => {
              if (typeof v === 'number') inboxes.set(v, []);
          });

          kernels.forEach(k => {
              if (!k.proc.isReady) return;
              const outMem = new Int32Array(k.proc.getMemory(), MEMORY.OUTPUT_QUEUE_ADDR, 1024);
              const count = outMem[0];
              
              if (count > 0) {
                  let offset = 1;
                  while (offset < count + 1) {
                      const header = outMem.subarray(offset, offset + PACKET_SIZE_INTS);
                      const op = header[0];
                      let packetLen = PACKET_SIZE_INTS;

                      if (op === Opcode.SYS_BLOB) {
                          const dataLen = header[3];
                          packetLen += dataLen;
                      }

                      const packet = outMem.subarray(offset, offset + packetLen);
                      forthService.logPacket(header[1], header[2], header[0], header[3], header[4], header[5]);

                      const target = header[2];

                      if (target === KernelID.HOST) {
                          if (op === Opcode.EVT_LEVEL_TRANSITION) {
                              handleLevelTransition(header[3]);
                          }
                      }

                      if (target === KernelID.BUS) {
                          for (const [key, inbox] of inboxes.entries()) {
                              if (key !== header[1]) {
                                  inbox.push(...packet);
                              }
                          }
                      }
                      else if (target !== KernelID.HOST) {
                          const inbox = inboxes.get(target);
                          if (inbox) {
                              inbox.push(...packet);
                          }
                      }

                      offset += packetLen;
                  }
                  outMem[0] = 0; // Clear Output Queue
              }
          });

          kernels.forEach(k => {
              if (!k.proc.isReady) return;
              const inboxData = inboxes.get(k.id);
              if (inboxData) {
                  const inMem = new Int32Array(k.proc.getMemory(), MEMORY.INPUT_QUEUE_ADDR, 1024);
                  if (inboxData.length > 0) {
                      inMem[0] = inboxData.length;
                      inMem.set(inboxData, 1);
                  } else {
                      inMem[0] = 0;
                  }
              }
          });
      };

      // 1. FIRST BROKER PASS
      runBroker();
      
      // 2. RUN CYCLES (The Heartbeat)
      kernels.forEach(k => {
          k.proc.run("PROCESS_INBOX");

          // Specialized cycles if defined
          if (k.proc.isWordDefined("RUN_HIVE_CYCLE")) k.proc.run("RUN_HIVE_CYCLE");
          if (k.proc.isWordDefined("RUN_ENV_CYCLE")) k.proc.run("RUN_ENV_CYCLE");
          if (k.proc.isWordDefined("RUN_BATTLE_CYCLE")) k.proc.run("RUN_BATTLE_CYCLE");
          if (k.proc.isWordDefined("RUN_PLAYER_CYCLE")) k.proc.run("RUN_PLAYER_CYCLE");
          if (k.proc.isWordDefined("RUN_GENERIC_CYCLE")) k.proc.run("RUN_GENERIC_CYCLE");
      });

      // 3. SECOND BROKER PASS: Deliver responses emitted during cycles
      runBroker();
      
      // 4. Update Inspector if active
      if (inspectStats) {
          handleInspect(inspectStats.x, inspectStats.y);
      }
  };

  // Inspect Entity at X, Y by checking Kernel Memory directly
  // Returns the ID found, or -1
  const getEntityAt = (x: number, y: number): number => {
      if (!activeKernels.has("GRID")) return -1;
      const gridProc = forthService.get("GRID");
      const gridMem = new DataView(gridProc.getMemory());
      const ENTITY_TABLE_ADDR = 0x90000; 
      const MAX_ENTITIES = 32;
      const GRID_ENT_SIZE = 20; 
      
      for (let i = 0; i < MAX_ENTITIES; i++) {
          const base = ENTITY_TABLE_ADDR + (i * GRID_ENT_SIZE);
          const entChar = gridMem.getInt32(base, true); 
          if (entChar === 0) continue; 
          
          const entY = gridMem.getInt32(base + 8, true);
          const entX = gridMem.getInt32(base + 12, true);
          
          if (entX === x && entY === y) {
              return i;
          }
      }
      return -1;
  };

  const handleInspect = (x: number, y: number) => {
      const foundId = getEntityAt(x, y);

      if (foundId !== -1) {
          const battleProc = forthService.get("BATTLE");
          const battleMem = new DataView(battleProc.getMemory());
          const RPG_TABLE_ADDR = 0xA0000; 
          const RPG_ENT_SIZE = 36;
          const base = RPG_TABLE_ADDR + (foundId * RPG_ENT_SIZE);
          
          const hp = battleMem.getInt32(base, true);
          const maxHp = battleMem.getInt32(base + 4, true);
          const atk = battleMem.getInt32(base + 8, true);
          const def = battleMem.getInt32(base + 12, true);
          const state = battleMem.getInt32(base + 24, true);
          const invItem = battleMem.getInt32(base + 32, true);

          setInspectStats({
              id: foundId,
              x, y,
              hp, maxHp, atk, def, state, invItem
          });
      } else {
          setInspectStats(null);
      }
  };

  const animate = (time: number) => {
    if (viewMode === "ARCHITECT") return;

    if (mode === "GRID") {
      const mainProc = forthService.get("GRID");
      if (mainProc && mainProc.isReady && activeKernels.has("GRID")) {
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
      const platProc = forthService.get("PLATFORM");
      if (platProc && platProc.isReady && activeKernels.has("PLATFORM")) {
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
            const platProc = forthService.get("PLATFORM");
            if (platProc.isReady) {
                if (k === "ArrowUp") platProc.run("CMD_JUMP");
                if (k === "Escape") switchMode("GRID");
            }
            return;
        }

        if (mode !== "GRID") return;
        
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
                    // Re-evaluate range immediately for current cursor pos
                    const dist = Math.abs(cursorPos.x - playerPos.x) + Math.abs(cursorPos.y - playerPos.y);
                    setIsValidTarget(dist <= skill.range);
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
            
            setCursorPos({x: cx, y: cy});
            
            // Range Check
            if (selectedSkill) {
                const dist = Math.abs(cx - playerPos.x) + Math.abs(cy - playerPos.y);
                setIsValidTarget(dist <= selectedSkill.range);
            }

            if (k === "Enter" && selectedSkill) {
                if (!isValidTarget) {
                    addLog("TARGET OUT OF RANGE!");
                    return;
                }
                const targetId = getEntityAt(cx, cy);
                if (targetId !== -1) {
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
                if (skill.name === "HEAL") {
                    // Instant Self Cast
                    const playerProc = forthService.get("PLAYER");
                    if (playerProc && playerProc.isReady) {
                        // Target = 0 (Self)
                        const cmd = `0 OUT_PTR ! 303 2 255 0 0 ${skill.id} BUS_SEND`;
                        playerProc.run(cmd);
                        tickSimulation();
                        addLog("Casting Self Heal...");
                    }
                } else {
                    // Requires Targeting
                    setSelectedSkill(skill);
                    setTargetMode(true);
                    setCursorPos({...playerPos}); // Reset cursor to player
                    setIsValidTarget(true); // Range 0 is valid at start
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
                
                // Track player position on success (for range checks)
                // Note: Real position is in Wasm, this is a client prediction/cache.
                // ideally we read it from EVT_MOVED, but this is responsive enough.
                setPlayerPos(prev => {
                    const nx = prev.x + dx;
                    const ny = prev.y + dy;
                    // Simple bounds clamp for local state
                    if (nx < 0 || nx >= MEMORY.GRID_WIDTH || ny < 0 || ny >= MEMORY.GRID_HEIGHT) return prev;
                    return {x: nx, y: ny};
                });
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
          
          <div style={{ padding: '10px', borderBottom: '1px solid #333' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9em' }}>
                  <input 
                      type="checkbox" 
                      checked={filterMovement} 
                      onChange={(e) => setFilterMovement(e.target.checked)} 
                      style={{ marginRight: '10px' }}
                  />
                  HIDE MOVEMENT/PHYSICS
              </label>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', fontSize: '11px', fontFamily: 'monospace' }}>
              {busHistory.map((p, i) => (
                  <div key={i} style={{ marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
                      <div style={{ color: '#666' }}>{p.timestamp}</div>
                      <div><span style={{color: 'cyan'}}>{p.sender}</span> &gt; <span style={{color: 'magenta'}}>{p.target}</span></div>
                      <div style={{ color: 'white' }}>{p.op}</div>
                      <div style={{ color: '#888' }}>{p.payload}</div>
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
            <button onClick={() => setViewMode("GAME")} style={{ background: viewMode === "GAME" ? "#0f0" : "#222", color: viewMode === "GAME" ? "#000" : "#0f0", border: "1px solid #0f0", padding: "5px 15px", cursor: "pointer" }}>SIMULATION</button>
            <button onClick={() => setViewMode("ARCHITECT")} style={{ background: viewMode === "ARCHITECT" ? "#f0f" : "#222", color: viewMode === "ARCHITECT" ? "#000" : "#f0f", border: "1px solid #f0f", padding: "5px 15px", cursor: "pointer" }}>ARCHITECT</button>
          </div>
        )}
        <span style={{ color: mode === "GRID" ? "cyan" : "orange" }}>STATUS: {mode}</span>
      </div>

      <div style={{ flex: "1 1 auto", position: "relative", display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
        
        {/* BOOT MODE */}
        {mode === "BOOT" && (
          <div style={{ textAlign: "center" }}>
            <h1>WORLD SEED INPUT</h1>
            <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ background: "#000", border: "1px solid #0f0", color: "#0f0", padding: "10px", fontSize: "1.2em", width: "300px", textAlign: "center" }} />
            <br /><br />
            <div style={{ color: "#666", marginBottom: "10px" }}>Tip: Shift+Click for Instant Mock World</div>
            <button onClick={handleGenerate} style={{ background: "#0f0", color: "#000", border: "none", padding: "10px 20px", fontSize: "1.2em", cursor: "pointer" }}>INITIATE GENERATION</button>
          </div>
        )}

        {/* LOADING MODE */}
        {mode === "GENERATING" && <div style={{ textAlign: "center" }}><h1>SYNCING KERNELS...</h1></div>}

        {/* VIEW MODES */}
        {viewMode === "ARCHITECT" && worldInfo && <ArchitectView data={worldInfo} />}

        {viewMode === "GAME" && (mode === "GRID" || mode === "PLATFORM") && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            
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
                    <div>INV: <span style={{color:"yellow"}}>{inspectStats.invItem || "NONE"}</span></div>
                    <button onClick={() => setInspectStats(null)} style={{marginTop: "10px", width: "100%", background: "#222", color: "#fff", border: "1px solid #555", cursor: "pointer"}}>CLOSE</button>
                </div>
            )}

            <div style={{ border: "1px solid #333" }}>
              <TerminalCanvas 
                memoryBuffer={displayBuffer} 
                width={MEMORY.GRID_WIDTH} 
                height={MEMORY.GRID_HEIGHT} 
                onGridClick={handleInspect}
                cursor={targetMode ? cursorPos : isValidTarget ? null : {x: -1, y: -1}} // Hide default cursor if not target mode, or logic handled inside
              />
              {/* Overlay for Invalid Target */}
              {targetMode && !isValidTarget && (
                  <div style={{
                      position: 'absolute', left: 0, right: 0, textAlign: 'center', 
                      color: 'red', fontWeight: 'bold', background: 'rgba(0,0,0,0.5)', pointerEvents: 'none'
                  }}>
                      OUT OF RANGE
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
