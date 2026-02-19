
import { forthService, ForthProcess } from "../services/WaForthService";
import { KernelID } from "../types/Protocol";

export class KernelTestRunner {
  proc: ForthProcess;
  id: string;
  kernelId: number;

  constructor(id: string, kernelId: number) {
    this.id = id;
    this.kernelId = kernelId;
    this.proc = forthService.get(id);
  }

  async boot(blocks: string[]) {
    await this.proc.boot();
    for (const block of blocks) {
        this.proc.run(block);
    }
  }

  run(cmd: string): string {
    const logStart = this.proc.outputLog.length;
    this.proc.run(cmd);

    // Extract new entries (including direct JS_LOG calls which don't have [STDOUT] prefix)
    const newLogs = this.proc.outputLog.slice(logStart)
        .map(l => {
            if (l.includes("[STDOUT] ")) return l.split("[STDOUT] ")[1];
            // JS_LOG entries look like: [HIVE 15:00:00] Message
            return l.split("] ").slice(1).join("] ");
        })
        .join(" ")
        .trim();

    return newLogs;
  }

  getMemory() {
      return this.proc.getMemory();
  }

  get forth() {
      return this.proc.forth;
  }
}
