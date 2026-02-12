
import WAForthPkg from "waforth";
import { KernelID, Opcode, PACKET_SIZE_INTS, VSO_REGISTRY } from "../types/Protocol";

const WAForth = (WAForthPkg as any).default || WAForthPkg;

export interface BusPacket {
  timestamp: string;
  sender: string;
  target: string;
  op: string;
  payload: string;
}

// Individual Process Class (The Virtual Machine)
export class ForthProcess {
  id: string;
  forth: WAForth;
  isReady: boolean = false;
  outputLog: string[] = [];
  emitBuffer: string = ""; // Buffer for standard output
  
  // Multicast Log Listeners
  private logListeners: Set<(msg: string) => void> = new Set();
  
  // Event Listeners
  onEvent: ((code: number) => void) | null = null;
  
  // Log Deduplication State
  private lastLogMsg: string = "";
  private lastLogCount: number = 0;

  constructor(id: string, private manager: ForthProcessManager) {
    this.id = id;
    this.forth = new WAForth();
  }

  addLogListener(cb: (msg: string) => void) {
      this.logListeners.add(cb);
  }

  removeLogListener(cb: (msg: string) => void) {
      this.logListeners.delete(cb);
  }

  async boot() {
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

        // 2. Grow Memory to support VRAM
        const currentPages = this.forth.memory().buffer.byteLength / 65536;
        if (currentPages < 20) {
            this.forth.memory().grow(20);
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
            this.log(`VSO Registered: Type ${typeId} at ${addr} (size ${sizeBytes}) owned by ${this.id}`);
        }
    });

    // : JS_SYNC_OBJECT ( id typeId -- ptr ) S" JS_SYNC_OBJECT" SCALL ;
    this.forth.bind("JS_SYNC_OBJECT", (stack: any) => {
        const typeId = stack.pop();
        const id = stack.pop();

        // 1. Find Registry Entry
        let entry: any = Object.values(VSO_REGISTRY).find(v => v.typeId === typeId) ||
                         this.manager.dynamicVsoRegistry.get(typeId);

        if (!entry) {
            this.log(`SYNC ERR: Unknown TypeID ${typeId}`);
            stack.push(0);
            return;
        }

        // 2. Locate Source Kernel
        const ownerName = typeof entry.owner === 'number' ? KernelID[entry.owner] : entry.owner;
        const srcProc = this.manager.processes.get(ownerName);
        if (!srcProc || !srcProc.isReady) {
            this.log(`SYNC ERR: Source Kernel ${KernelID[entry.owner]} not ready`);
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
                this.log(`SYNC ERR: Source OOB at ${srcAddr}`);
                stack.push(0);
                return;
            }

            // Copy bytes
            destMem.set(srcMem.subarray(srcAddr, srcAddr + entry.sizeBytes), destAddr);

            // Return pointer to temp buffer
            stack.push(destAddr);
        } catch (e) {
            this.log(`SYNC ERR: ${e}`);
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

  log(msg: string) {
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
    if (!this.forth) return false;
    try {
        this.forth.interpret(`' ${wordName} DROP`);
        return true;
    } catch (e) {
        return false;
    }
  }

  getMemory() {
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

  logPacket(senderId: number, targetId: number, op: number, p1: number, p2: number, p3: number) {
      const packet: BusPacket = {
          timestamp: new Date().toLocaleTimeString(),
          sender: KernelID[senderId] || String(senderId),
          target: KernelID[targetId] || String(targetId),
          op: Opcode[op] || String(op),
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
