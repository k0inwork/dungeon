
import { KernelTestRunner } from "./KernelRunner";
import { KernelID, Opcode, PACKET_SIZE_INTS, VSO_REGISTRY } from "../types/Protocol";
import { MEMORY } from "../constants/Memory";

export class IntegrationSimulator {
    kernels: Map<number, KernelTestRunner> = new Map();
    busLog: string[] = [];
    channelSubscriptions: Map<number, Set<number>> = new Map();

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
        const entry = Object.values(VSO_REGISTRY).find(v => v.typeId === typeId);
        if (!entry) return stack.push(0);

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

        destMem.set(srcMem.subarray(srcAddr, srcAddr + entry.sizeBytes), destAddr);
        stack.push(destAddr);
    }

    tick() {
        const inboxes: Record<number, number[]> = {};
        this.kernels.forEach((_, id) => inboxes[id] = []);

        const pendingPackets: { senderId: number, data: Int32Array }[] = [];

        // 1. HARVEST & REGISTER SUBSCRIPTIONS
        this.kernels.forEach((k, id) => {
            const mem = new Int32Array(k.getMemory());
            const outAddr = MEMORY.OUTPUT_QUEUE_ADDR / 4;
            const count = mem[outAddr];

            if (count > 0) {
                const data = new Int32Array(mem.subarray(outAddr + 1, outAddr + 1 + count));
                pendingPackets.push({ senderId: id, data });

                // Pre-scan for subscriptions to ensure they are active for messages in the same tick
                let offset = 0;
                while (offset < count) {
                    const op = data[offset];
                    console.log(`[SIM] Pre-scan Kernel ${id} Packet at offset ${offset}: Op=${op} Target=${data[offset+2]} P1=${data[offset+3]}`);
                    if (op === Opcode.SYS_CHAN_SUB) {
                        const chanId = data[offset + 3];
                        console.log(`[SIM] Registering SUB: Kernel ${id} to Channel ${chanId}`);
                        if (!this.channelSubscriptions.has(chanId)) this.channelSubscriptions.set(chanId, new Set());
                        this.channelSubscriptions.get(chanId)!.add(id);
                    } else if (op === Opcode.SYS_CHAN_UNSUB) {
                        this.channelSubscriptions.get(data[offset + 3])?.delete(id);
                    }
                    offset += PACKET_SIZE_INTS;
                }
                mem[outAddr] = 0; // Clear
            }
        });

        // 2. ROUTE MESSAGES
        pendingPackets.forEach(({ senderId, data }) => {
            let offset = 0;
            const count = data.length;
            while (offset < count) {
                const op = data[offset];
                const target = data[offset + 2];
                const packet = data.subarray(offset, offset + PACKET_SIZE_INTS);

                // Skip system packets (already handled in pass 1)
                if (op === Opcode.SYS_CHAN_SUB || op === Opcode.SYS_CHAN_UNSUB) {
                    offset += PACKET_SIZE_INTS;
                    continue;
                }

                // Logging
                const opName = Opcode[op] || op;
                const senderName = KernelID[senderId] || senderId;
                const targetName = KernelID[target] || target;
                const msg = `[BUS] ${senderName} -> ${targetName}: ${opName} (${data[offset+3]}, ${data[offset+4]}, ${data[offset+5]})`;
                this.busLog.push(msg);

                if (target >= 1000) {
                    const subs = Array.from(this.channelSubscriptions.get(target) || []);
                    this.channelSubscriptions.get(target)?.forEach(subId => {
                        if (subId !== senderId) {
                            const inbox = inboxes[subId];
                            if (inbox) inbox.push(...packet);
                        }
                    });
                } else if (target === KernelID.BUS) {
                    Object.keys(inboxes).forEach(tid => {
                        if (Number(tid) !== senderId) inboxes[Number(tid)].push(...packet);
                    });
                } else if (inboxes[target]) {
                    inboxes[target].push(...packet);
                }
                offset += PACKET_SIZE_INTS;
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
            if (k.id === 'HIVE') k.proc.run("RUN_HIVE_CYCLE");
        });
    }
}
