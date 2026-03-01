
import { forthService } from './WaForthService';
import { KernelID, getInstanceID, Opcode, PACKET_SIZE_INTS } from '../types/Protocol';
import { MEMORY } from '../constants/Memory';

export interface BrokerState {
    channelSubscriptions: Map<number, Set<number>>;
    onGameOver: () => void;
    isGameOver: () => boolean;
    onPlayerMoved: (x: number, y: number) => void;
    onLevelTransition: (targetLevelId: number) => void;
}

export class SimulationEngine {
    private state: BrokerState;

    constructor(state: BrokerState) {
        this.state = state;
    }

    public runBroker(kernels: any[], levelIdx: number) {
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
                        packetLen += Math.max(0, header[3]);
                    }

                    if (packetLen < 6 || offset + packetLen > count + 1) {
                        console.error(`[BROKER] Corrupt packet detected in KERNEL=${k.id}: op=${op} len=${packetLen} offset=${offset} count=${count}`);
                        break;
                    }

                    const packet = outMem.subarray(offset, offset + packetLen);
                    forthService.logPacket(senderRole, targetRole, op, header[3], header[4], header[5]);

                    if (targetRole === KernelID.HOST || targetRole === KernelID.BUS) {
                        if (op === Opcode.EVT_DEATH && header[3] === 0) {
                            console.log(`[ENGINE] GAME OVER triggered by KERNEL=${k.id} packet: op=${op} sender=${senderRole} p1=${header[3]} p2=${header[4]} p3=${header[5]}`);

                            // Authoritative Verification: Check Player Kernel Memory
                            const playerProc = forthService.get("PLAYER");
                            if (playerProc?.isLogicLoaded) {
                                const mem = new DataView(playerProc.getMemory());
                                const hp = mem.getInt32(0xC0000, true);
                                if (hp <= 0) {
                                    this.state.onGameOver();
                                } else {
                                    console.warn(`[ENGINE] Suppressed BOGUS Game Over. Player HP is ${hp}`);
                                }
                            } else {
                                // If player kernel isn't even loaded, we shouldn't be dying.
                                console.warn(`[ENGINE] Ignoring death packet: Player Kernel logic not loaded.`);
                            }
                        }
                        if (op === Opcode.EVT_MOVED && header[3] === 0) {
                            this.state.onPlayerMoved(header[4], header[5]);
                        }
                        if (op === Opcode.EVT_LEVEL_TRANSITION) {
                            console.log(`[ENGINE] Transition detected to Level ${header[3]}`);
                            this.state.onLevelTransition(header[3]);
                        }
                    }

                    if (targetRole === KernelID.HOST) {
                        // Already handled above
                    } else if (targetRole === KernelID.BUS) {
                        for (const [instId, inbox] of inboxes.entries()) {
                            if (instId !== kInstId) inbox.push(...packet);
                        }
                    } else if (targetRole >= 1000) {
                        this.state.channelSubscriptions.get(targetRole)?.forEach(subInstId => {
                            if (subInstId !== kInstId) inboxes.get(subInstId)?.push(...packet);
                        });
                    } else {
                        // MAP ROLE TO INSTANCE ID
                        const targetInstId = getInstanceID(targetRole, levelIdx);

                        // Handle legacy "PLAYER" string vs role ID 2
                        const destId = targetRole === KernelID.PLAYER ? 2 : targetInstId;

                        if (inboxes.has(destId)) {
                             inboxes.get(destId)?.push(...packet);
                        } else {
                             console.warn(`[BROKER] Target ${destId} (Role ${targetRole}) not in tick list`);
                        }
                    }

                    if (op === Opcode.SYS_CHAN_SUB) {
                        const chanId = header[4]; // Standardized p2
                        if (!this.state.channelSubscriptions.has(chanId)) this.state.channelSubscriptions.set(chanId, new Set());
                        this.state.channelSubscriptions.get(chanId)!.add(kInstId);
                    } else if (op === Opcode.SYS_CHAN_UNSUB) {
                        this.state.channelSubscriptions.get(header[4])?.delete(kInstId);
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
    }

    public tickSimulation(currentLevelIdx: number, simulationMode: string, currentLevelId: string) {
        if (this.state.isGameOver()) return;
        const lIdx = currentLevelIdx;
        const physicsRole = simulationMode === 'PLATFORM' ? KernelID.PLATFORM : KernelID.GRID;
        const gridId = String(getInstanceID(physicsRole, lIdx));
        const hiveId = String(getInstanceID(KernelID.HIVE, lIdx));
        const battleId = String(getInstanceID(KernelID.BATTLE, lIdx));

        const main = forthService.get(gridId);
        const hive = forthService.get(hiveId);
        const player = forthService.get("PLAYER");
        const battle = forthService.get(battleId);

        if (!main?.isLogicLoaded || !player?.isLogicLoaded) return;

        const activeKernelsList: any[] = [main, player];
        if (hive?.isLogicLoaded) activeKernelsList.push(hive);
        if (battle?.isLogicLoaded) activeKernelsList.push(battle);

        // Deliver move requests
        this.runBroker(activeKernelsList, lIdx);
        activeKernelsList.forEach(k => k.run("PROCESS_INBOX"));

        // AI decides actions
        if (hive?.isLogicLoaded) hive.run("RUN_HIVE_CYCLE");
        if (simulationMode === "GRID") main.run("RUN_ENV_CYCLE");

        // Deliver AI actions and physics collisions
        this.runBroker(activeKernelsList, lIdx);
        activeKernelsList.forEach(k => k.run("PROCESS_INBOX"));

        // Deliver combat triggers
        this.runBroker(activeKernelsList, lIdx);
        activeKernelsList.forEach(k => k.run("PROCESS_INBOX"));

        // Deliver final results
        this.runBroker(activeKernelsList, lIdx);
        activeKernelsList.forEach(k => k.run("PROCESS_INBOX"));
    }
}
