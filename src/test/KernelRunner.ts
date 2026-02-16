
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

    console.log(`[Runner] Logs for ${cmd}:`, this.proc.outputLog.slice(logStart));

    // Extract new STDOUT and JS_LOG entries
    const newLogs = this.proc.outputLog.slice(logStart)
        .map(l => {
            if (l.includes("[STDOUT]")) return l.split("[STDOUT] ")[1];
            // JS_LOG messages don't have a special tag, they just have the process header [NAME HH:MM:SS]
            const parts = l.split("] ");
            if (parts.length > 1) return parts.slice(1).join("] ");
            return l;
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
