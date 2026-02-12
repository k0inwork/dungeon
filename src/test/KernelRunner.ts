
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

    // Extract new STDOUT entries
    const newLogs = this.proc.outputLog.slice(logStart)
        .filter(l => l.includes("[STDOUT]"))
        .map(l => l.split("[STDOUT] ")[1])
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
