
import { KernelTestRunner } from "./KernelRunner";
import { forthService } from "../services/WaForthService";
import { KernelID, Opcode, PACKET_SIZE_INTS, VSO_REGISTRY } from "../types/Protocol";
import { MEMORY } from "../constants/Memory";

export class IntegrationSimulator {
    kernels: Map<number, KernelTestRunner> = new Map();
    busLog: string[] = [];
    packetLog: any[] = [];

    busSend(op: number, sender: number, target: number, p1: number, p2: number, p3: number) {
        const k = this.kernels.get(sender);
        if (k) {
            k.proc.run(`0 OUT_PTR ! ${op} ${sender} ${target} ${p1} ${p2} ${p3} BUS_SEND`);
        }
    }

    addKernel(id: number, name: string, runner: KernelTestRunner) {
        this.kernels.set(id, runner);

        // Wire up JS_SYNC_OBJECT for this runner
        runner.forth.bind("JS_SYNC_OBJECT", (stack: any) => {
            const typeId = stack.pop();
            const id = stack.pop();
            return this.handleSync(runner, id, typeId, stack);
        });
    }

    handleSync(requestor: KernelTestRunner, id: number, typeId: number, stack: any) {
        const entry = (Object.values(VSO_REGISTRY).find(v => v.typeId === typeId) ||
                       forthService.dynamicVsoRegistry.get(typeId)) as any;

        if (!entry) {
            console.error(`[SIM] Sync Error: Unknown TypeID ${typeId}`);
            return stack.push(0);
        }

        const source = this.kernels.get(entry.owner);
        if (!source) return stack.push(0);

        const srcMem = new Uint8Array(source.getMemory());
        const destMem = new Uint8Array(requestor.getMemory());

        const srcAddr = entry.baseAddr + (id * entry.sizeBytes);
        const destAddr = 0xD0000; // TEMP_VSO_BUFFER

        if (srcAddr + entry.sizeBytes > srcMem.length) {
            stack.push(0);
            return;
        }

        const data = srcMem.subarray(srcAddr, srcAddr + entry.sizeBytes);
        console.log(`[SIM] Syncing Type ${typeId} ID ${id} from Addr ${srcAddr.toString(16)}. Data:`, data.subarray(0, 4));
        destMem.set(data, destAddr);
        stack.push(destAddr);
    }

    tick() {
        const inboxes: Record<number, number[]> = {};
        this.kernels.forEach((_, id) => inboxes[id] = []);

        // 1. HARVEST
        this.kernels.forEach((k, id) => {
            const mem = new Int32Array(k.getMemory());
            const outAddr = MEMORY.OUTPUT_QUEUE_ADDR / 4;
            const count = mem[outAddr];

            if (count > 0) {
                const data = mem.subarray(outAddr + 1, outAddr + 1 + count);
                let offset = 0;
                while (offset < count) {
                    const op = data[offset];
                    const target = data[offset + 2];
                    const packetLen = PACKET_SIZE_INTS;
                    const packet = data.subarray(offset, offset + packetLen);

                    // Logging for Trace
                    const opName = Opcode[op] || op;
                    const senderName = KernelID[id] || id;
                    const targetName = KernelID[target] || target;
                    this.busLog.push(`[BUS] ${senderName} -> ${targetName}: ${opName} (${data[offset+3]}, ${data[offset+4]}, ${data[offset+5]})`);
                    this.packetLog.push({
                        op: opName,
                        sender: senderName,
                        target: targetName,
                        p1: data[offset+3],
                        p2: data[offset+4],
                        p3: data[offset+5]
                    });

                    if (target === KernelID.BUS) {
                        Object.keys(inboxes).forEach(tid => {
                            if (Number(tid) !== id) inboxes[Number(tid)].push(...packet);
                        });
                    } else if (inboxes[target]) {
                        inboxes[target].push(...packet);
                    }
                    offset += packetLen;
                }
                mem[outAddr] = 0; // Clear
            }
        });

        // 2. ROUTE
        this.kernels.forEach((k, id) => {
            const mem = new Int32Array(k.getMemory());
            const inAddr = MEMORY.INPUT_QUEUE_ADDR / 4;
            const data = inboxes[id];
            if (data.length > 0) {
                mem[inAddr] = data.length;
                mem.set(data, inAddr + 1);
            } else {
                mem[inAddr] = 0;
            }
        });

        // 3. PROCESS
        this.kernels.forEach(k => {
            k.proc.run("PROCESS_INBOX");
            if (k.proc.isWordDefined("RUN_HIVE_CYCLE")) k.proc.run("RUN_HIVE_CYCLE");
            if (k.proc.isWordDefined("RUN_ENV_CYCLE")) k.proc.run("RUN_ENV_CYCLE");
            if (k.proc.isWordDefined("RUN_BATTLE_CYCLE")) k.proc.run("RUN_BATTLE_CYCLE");
            if (k.proc.isWordDefined("RUN_PLAYER_CYCLE")) k.proc.run("RUN_PLAYER_CYCLE");
            if (k.proc.isWordDefined("RUN_GENERIC_CYCLE")) k.proc.run("RUN_GENERIC_CYCLE");
        });
    }
}
