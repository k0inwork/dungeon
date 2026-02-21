
import WAForthPkg from "waforth";
import { KernelID, Opcode, PACKET_SIZE_INTS, VSO_REGISTRY, hashChannel,getInstanceID } from "../types/Protocol";

const WAForth = (WAForthPkg as any).default || WAForthPkg;

export interface BusPacket {
  timestamp: string;
  sender: string;
  target: string;
  senderId: number;
  targetId: number;
  op: string;
  opcode: number;
  payload: string;
}

export type ProcessStatus = "ACTIVE" | "PAUSED" | "FLASHED";

// Individual Process Class (The Virtual Machine)
export class ForthProcess {
  id: string;
  levelIdx: number = 0;
  forth: WAForth | null = null;
  status: ProcessStatus = "PAUSED";
  isReady: boolean = false;
  isLogicLoaded: boolean = false;
  outputLog: string[] = [];
  emitBuffer: string = ""; // Buffer for standard output
  logicBlocks: string[] = []; // Store blocks for restoration
  lastUsed: number = Date.now();
  flashData: Uint8Array | null = null;

  // Multicast Log Listeners
  private logListeners: Set<(msg: string) => void> = new Set();
  
  // Event Listeners
  onEvent: ((code: number) => void) | null = null;
  
  // Log Deduplication State
  private lastLogMsg: string = "";
  private lastLogCount: number = 0;

  constructor(id: string, private manager: ForthProcessManager) {
    this.id = id;
  }

  addLogListener(cb: (msg: string) => void) {
      this.logListeners.add(cb);
  }

  removeLogListener(cb: (msg: string) => void) {
      this.logListeners.delete(cb);
  }

  async boot() {
    this.forth = new WAForth();

    // 1. Bind Low-Level Emit (Standard Output)
    this.forth.onEmit = (c: any) => {
       const char = typeof c === 'string' ? c : String.fromCharCode(c);
       if (char === '\n') {
         if (this.emitBuffer) {
            this.log(`[STDOUT] ${this.emitBuffer}`);
            this.emitBuffer = "";
         }
       } else {
         this.emitBuffer += char;
       }
    };

    try {
        await this.forth.load();

        // 2. Grow Memory to support VRAM (64 pages = 4MB)
        const currentPages = this.forth.memory().buffer.byteLength / 65536;
        if (currentPages < 64) {
            this.forth.memory().grow(64 - currentPages);
            this.log(`Memory Grown. Total: ${this.forth.memory().buffer.byteLength} bytes`);
        }
        
        // 3. Bind Host Functions
        // These are called from Forth via: S" NAME" SCALL
        this.bindHostFunctions();
        
        // 4. Verification
        // SCALL is a built-in word in WAForth, so we check if our high-level wrappers will compile
        this.isReady = true;
        this.log("Process Booted.");
        
    } catch (e: any) {
        console.error(`[${this.id}] Boot Failed:`, e);
        this.log(`[BOOT_ERR] ${e.message}`);
        this.isReady = false;
    }
  }

  private bindHostFunctions() {
    // : JS_LOG ( addr len -- ) S" JS_LOG" SCALL ;
    this.forth.bind("JS_LOG", (stack: any) => {
       const len = stack.pop();
       const addr = stack.pop();
       const msg = this.readString(addr, len);
       this.log(msg);
    });

    // : JS_EVENT ( code -- ) S" JS_EVENT" SCALL ;
    this.forth.bind("JS_EVENT", (stack: any) => {
       const code = stack.pop();
       this.log(`EVENT TRIGGERED: ${code}`);
       if (this.onEvent) this.onEvent(code);
    });

    // : JS_ERR ( code -- ) S" JS_ERR" SCALL ;
    this.forth.bind("JS_ERR", (stack: any) => {
       const code = stack.pop();
       this.log(`CRITICAL ERROR: ${code}`);
    });

    // : JS_ASSERT ( actual expected -- ) S" JS_ASSERT" SCALL ;
    this.forth.bind("JS_ASSERT", (stack: any) => {
        const expected = stack.pop();
        const actual = stack.pop();
        if (actual !== expected) {
            const msg = `ASSERTION FAILED: Expected ${expected}, got ${actual}`;
            this.log(msg);
            console.error(`[${this.id}] ${msg}`);
            // In browser we might not want to throw and crash the whole engine,
            // but in tests we definitely want to know.
        }
    });

    // : JS_REGISTER_VSO ( addr typeId sizeBytes -- ) S" JS_REGISTER_VSO" SCALL ;
    this.forth.bind("JS_REGISTER_VSO", (stack: any) => {
        const sizeBytes = stack.pop();
        const typeId = stack.pop();
        const addr = stack.pop();

        // Find numerical ID of current kernel
        const currentKernelId = Object.entries(KernelID).find(([name, val]) => val === Number(this.id) || name === this.id)?.[1];

        if (currentKernelId !== undefined) {
            this.manager.dynamicVsoRegistry.set(typeId, {
                owner: Number(currentKernelId),
                baseAddr: addr,
                sizeBytes: sizeBytes
            });
            this.log(`[STDOUT] VSO Registered: Type ${typeId} at ${addr} (size ${sizeBytes}) owned by ${this.id}`);
        }
    });

    // : JS_SYNC_OBJECT ( id typeId -- ptr ) S" JS_SYNC_OBJECT" SCALL ;
    this.forth!.bind("JS_SYNC_OBJECT", (stack: any) => {
        const typeId = stack.pop();
        const id = stack.pop();

        // 1. Find Registry Entry
        let entry: any = Object.values(VSO_REGISTRY).find(v => v.typeId === typeId) ||
                         this.manager.dynamicVsoRegistry.get(typeId);

        if (!entry) {
            this.log(`[STDOUT] SYNC ERR: Unknown TypeID ${typeId}`);
            stack.push(0);
            return;
        }

        // 2. Locate Source Kernel (Level-Aware)
        const ownerRole = typeof entry.owner === 'number' ? entry.owner : (KernelID as any)[entry.owner];
        const targetInstanceID = getInstanceID(ownerRole, this.levelIdx);
        const ownerName = String(targetInstanceID);

        let srcProc = this.manager.processes.get(ownerName);

        // Fallback for legacy named lookups if numeric fails
        if (!srcProc) {
            const legacyName = typeof entry.owner === 'number' ? KernelID[entry.owner] : entry.owner;
            srcProc = this.manager.processes.get(legacyName);
        }

        if (!srcProc || !srcProc.isReady) {
            this.log(`[STDOUT] SYNC ERR: Source Kernel ${ownerName} not ready`);
            stack.push(0);
            return;
        }

        // 3. Perform DMA (Host Copy)
        try {
            const srcMem = new Uint8Array(srcProc.getMemory());
            const destMem = new Uint8Array(this.getMemory());

            const srcAddr = entry.baseAddr + (id * entry.sizeBytes);
            const destAddr = 0xD0000; // TEMP_VSO_BUFFER

            // Safety Checks
            if (srcAddr + entry.sizeBytes > srcMem.length) {
                this.log(`[STDOUT] SYNC ERR: Source OOB at ${srcAddr}`);
                stack.push(0);
                return;
            }

            // Copy bytes
            destMem.set(srcMem.subarray(srcAddr, srcAddr + entry.sizeBytes), destAddr);

            // Return pointer to temp buffer
            stack.push(destAddr);
        } catch (e) {
            this.log(`[STDOUT] SYNC ERR: ${e}`);
            stack.push(0);
        }
    });
  }

  private readString(addr: number, len: number): string {
    try {
        const mem = new Uint8Array(this.forth.memory().buffer);
        if (addr < 0 || addr + len > mem.byteLength) {
            return `[INVALID_PTR ${addr}]`;
        }
        return new TextDecoder().decode(mem.subarray(addr, addr + len));
    } catch(e) {
        return "[MEM_READ_ERR]";
    }
  }

  async hibernate() {
    if (this.status === "FLASHED" || !this.forth) return;
    this.log("[SYS] Hibernating Kernel to Disk...");
    this.flashData = this.serialize();
    this.forth = null; // Release WASM instance
    this.isReady = false;
    this.status = "FLASHED";
    this.manager.notifyListeners();
  }

  async awaken() {
    if (this.status !== "FLASHED" || !this.flashData) return;
    this.log("[SYS] Awakening Kernel from Disk...");
    this.status = "PAUSED"; // Temporary state to allow run()

    // 1. Re-boot WASM
    await this.boot();

    // 2. Re-load Logic Blocks (Re-compiles words)
    for (const block of this.logicBlocks) {
        this.run(block);
    }

    // 3. Restore Memory State
    this.deserialize(this.flashData);
    this.flashData = null;
    this.status = "ACTIVE";
    this.isReady = true;
    this.manager.notifyListeners();
  }

  serialize(): Uint8Array {
    if (!this.forth) return this.flashData || new Uint8Array(0);

    // Try to find HERE if word is defined
    let here = 200000; // Default safety for dictionary
    try {
        if (this.isWordDefined("SYNC_HERE")) {
            this.forth.interpret("SYNC_HERE\n");
            const view = new DataView(this.forth.memory().buffer);
            here = view.getInt32(1008, true); // 0x3F0
        }
    } catch(e) {}

    // Determine highest used address based on VSO Registry and common maps
    // Maps: 0x30000 to 0x34000
    // Entities: 0x90000, RPG: 0xA0000, Player: 0xC0000
    let maxAddr = Math.max(here, 0xD0000); // 0xD0000 covers all current regions

    const fullMem = new Uint8Array(this.forth.memory().buffer);
    const sliceSize = Math.min(fullMem.length, maxAddr);
    return new Uint8Array(fullMem.slice(0, sliceSize));
  }

  deserialize(data: Uint8Array) {
    if (!this.forth) return;
    const currentMem = new Uint8Array(this.forth.memory().buffer);
    currentMem.set(data);
  }

  log(msg: string) {
    this.lastUsed = Date.now();
    // Deduplication Logic
    if (msg === this.lastLogMsg) {
        this.lastLogCount++;
        if (this.outputLog.length > 0) {
            const timestamp = new Date().toLocaleTimeString().split(" ")[0];
            const baseEntry = `[${this.id} ${timestamp}] ${msg}`;
            const entryWithCount = `${baseEntry} (x${this.lastLogCount + 1})`;
            
            this.outputLog[this.outputLog.length - 1] = entryWithCount;
        }
        return;
    }

    this.lastLogMsg = msg;
    this.lastLogCount = 0;

    const timestamp = new Date().toLocaleTimeString().split(" ")[0];
    const entry = `[${this.id} ${timestamp}] ${msg}`;
    
    this.outputLog.push(entry);
    if (this.outputLog.length > 50) this.outputLog.shift();
    
    // Multicast to Process Listeners
    this.logListeners.forEach(cb => cb(entry));
    
    // Multicast to Global Manager
    this.manager.broadcastLog(entry);
  }

  run(word: string) {
    this.lastUsed = Date.now();
    if (this.status === "FLASHED") {
        // Auto-awaken if called while flashed?
        // For now, index.tsx should handle this, but let's be safe
        console.warn(`[${this.id}] Attempted to run word while FLASHED. Ignoring.`);
        return;
    }
    if (!this.forth || !this.isReady) return;
    try {
      console.log(`[${this.id} RUN] ${word}`);
      this.forth.interpret(word + "\n");
      if (this.emitBuffer) {
        this.log(`[STDOUT] ${this.emitBuffer}`);
        this.emitBuffer = "";
      }
    } catch(e: any) {
      this.log(`EXEC ERROR: ${e.message}`);
      if (e.message !== this.lastLogMsg) {
         console.warn(`Failed Command in ${this.id}:`, word, e);
      }
      throw e;
    }
  }

  isWordDefined(wordName: string): boolean {
    if (!this.forth || this.status === "FLASHED") return false;
    const oldEmit = this.forth.onEmit;
    this.forth.onEmit = () => {}; // Mute output during check
    try {
        this.forth.interpret(`' ${wordName} DROP`);
        this.forth.onEmit = oldEmit;
        return true;
    } catch (e) {
        this.forth.onEmit = oldEmit;
        return false;
    }
  }

  getMemory(): ArrayBuffer {
    if (!this.forth) return (this.flashData?.buffer as ArrayBuffer) || new ArrayBuffer(0);
    return this.forth.memory().buffer;
  }
}

// The Manager Singleton
class ForthProcessManager {
  processes: Map<string, ForthProcess> = new Map();
  // Dynamic VSO Registry for exported AJS arrays
  dynamicVsoRegistry: Map<number, { owner: number, baseAddr: number, sizeBytes: number }> = new Map();
  listeners: ((ids: string[]) => void)[] = [];
  
  // Message Bus History
  busHistory: BusPacket[] = [];
  busListeners: Set<() => void> = new Set();

  // Channel Name Registry
  channelNames: Map<number, string> = new Map();
  
  // Global Log Bridge (For UI Chat)
  globalLogListeners: Set<(msg: string) => void> = new Set();

  get(id: string): ForthProcess {
    if (!this.processes.has(id)) {
      const proc = new ForthProcess(id, this);
      this.processes.set(id, proc);
      this.notifyListeners();
      return proc;
    }
    return this.processes.get(id)!;
  }

  async bootProcess(id: string) {
    const proc = this.get(id);
    await proc.boot();
    return proc;
  }

  subscribe(cb: (ids: string[]) => void) {
    this.listeners.push(cb);
    cb(Array.from(this.processes.keys()));
    return () => {
        this.listeners = this.listeners.filter(l => l !== cb);
    };
  }
  
  subscribeBus(cb: () => void) {
      this.busListeners.add(cb);
      return () => { this.busListeners.delete(cb); };
  }
  
  // Global Logs
  subscribeLogs(cb: (msg: string) => void) {
      this.globalLogListeners.add(cb);
      return () => { this.globalLogListeners.delete(cb); };
  }
  
  broadcastLog(msg: string) {
      this.globalLogListeners.forEach(cb => cb(msg));
  }

  registerChannel(name: string) {
      const id = hashChannel(name);
      if (!this.channelNames.has(id)) {
          this.channelNames.set(id, name);
      }
  }

  // --- PERSISTENCE & HYBERNATION v3.0 ---
  private MAX_ACTIVE_KERNELS = 10;

  async maintenance(currentLevelIdx: number) {
      const activeProcesses = Array.from(this.processes.values())
          .filter(p => p.status !== "FLASHED");

      if (activeProcesses.length > this.MAX_ACTIVE_KERNELS) {
          // Find candidates for hibernation:
          // 1. Not the PLAYER
          // 2. Not in the current level
          // 3. Sorted by lastUsed (LRU)
          const candidates = activeProcesses
              .filter(p => p.id !== "PLAYER" && p.levelIdx !== currentLevelIdx)
              .sort((a, b) => a.lastUsed - b.lastUsed);

          while (candidates.length > 0 &&
                 Array.from(this.processes.values()).filter(p => p.status !== "FLASHED").length > this.MAX_ACTIVE_KERNELS) {
              const toFlash = candidates.shift();
              if (toFlash) {
                  await toFlash.hibernate();
              }
          }
      }
  }

  private uint8ToBase64(arr: Uint8Array): string {
      let binary = '';
      const len = arr.byteLength;
      for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(arr[i]);
      }
      return btoa(binary);
  }

  private base64ToUint8(base64: string): Uint8Array {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
  }

  serializeAll() {
      const data: Record<string, any> = {};
      for (const [id, proc] of this.processes.entries()) {
          data[id] = {
              levelIdx: proc.levelIdx,
              status: proc.status,
              logicBlocks: proc.logicBlocks,
              flashData: this.uint8ToBase64(proc.serialize()),
              outputLog: proc.outputLog
          };
      }
      return {
          processes: data,
          channelNames: Array.from(this.channelNames.entries()),
          busHistory: this.busHistory.slice(0, 100) // Only save some history
      };
  }

  async deserializeAll(data: any) {
      this.processes.clear();
      this.channelNames = new Map(data.channelNames || []);
      this.busHistory = data.busHistory || [];

      for (const [id, procData] of Object.entries(data.processes)) {
          const proc = this.get(id);
          proc.levelIdx = (procData as any).levelIdx;
          proc.logicBlocks = (procData as any).logicBlocks;
          proc.outputLog = (procData as any).outputLog || [];

          const rawData = this.base64ToUint8((procData as any).flashData);
          if ((procData as any).status === "FLASHED") {
              proc.flashData = rawData;
              proc.status = "FLASHED";
              proc.isReady = false;
          } else {
              // If it was active, we should still boot and restore it
              await proc.boot();
              for (const block of proc.logicBlocks) {
                  proc.run(block);
              }
              proc.deserialize(rawData);
              proc.status = "ACTIVE";
              proc.isReady = true;
              proc.isLogicLoaded = true;
          }
      }
      this.notifyListeners();
  }

  logPacket(senderId: number, targetId: number, op: number, p1: number, p2: number, p3: number) {
      const packet: BusPacket = {
          timestamp: new Date().toLocaleTimeString(),
          sender: KernelID[senderId] || this.channelNames.get(senderId) || String(senderId),
          target: KernelID[targetId] || this.channelNames.get(targetId) || String(targetId),
          senderId,
          targetId,
          op: Opcode[op] || String(op),
          opcode: op,
          payload: `${p1}, ${p2}, ${p3}`
      };
      
      this.busHistory.unshift(packet);
      // Increased buffer size to prevent valid events (Damage) being pushed out by noise (Movement)
      if (this.busHistory.length > 5000) this.busHistory.pop();
      this.busListeners.forEach(cb => cb());
  }

  private notifyListeners() {
    const keys = Array.from(this.processes.keys());
    this.listeners.forEach(cb => cb(keys));
  }
}

export const forthService = new ForthProcessManager();
