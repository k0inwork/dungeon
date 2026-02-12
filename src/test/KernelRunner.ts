
import WAForthPkg from "waforth";
import { KernelID, VSO_REGISTRY } from "../types/Protocol";
import { STANDARD_KERNEL_FIRMWARE, BLOCK_STANDARD_INBOX } from "../kernels/SharedBlocks";

const WAForth = (WAForthPkg as any).default || WAForthPkg;

export class KernelTestRunner {
  forth: any;
  id: string;
  kernelId: number;
  output: string = "";
  isReady: boolean = false;

  constructor(id: string, kernelId: number) {
    this.id = id;
    this.kernelId = kernelId;
    this.forth = new WAForth();
  }

  async boot(blocks: string[]) {
    this.forth.onEmit = (c: number) => {
      if (c > 0) {
          console.log(`EMIT: ${c} (${String.fromCharCode(c)})`);
      }
      this.output += String.fromCharCode(c);
    };

    await this.forth.load();
    this.forth.memory().grow(20);

    // Bind basic host functions
    this.forth.bind("JS_LOG", (stack: any) => {
      const len = stack.pop();
      const addr = stack.pop();
      const mem = new Uint8Array(this.forth.memory().buffer);
      const msg = new TextDecoder().decode(mem.subarray(addr, addr + len));
      console.log(`[${this.id} LOG] ${msg}`);
    });

    this.forth.bind("JS_SYNC_OBJECT", (stack: any) => {
        const typeId = stack.pop();
        const id = stack.pop();
        console.log(`[${this.id} SYNC] Requesting type ${typeId} id ${id}`);
        // Mock sync: for now just return 0 or a fixed address if we want to test VSO
        stack.push(0);
    });

    this.forth.bind("JS_ERR", (stack: any) => {
        const code = stack.pop();
        console.error(`[${this.id} ERR] ${code}`);
    });

    this.forth.bind("JS_ASSERT", (stack: any) => {
        const expected = stack.pop();
        const actual = stack.pop();
        if (actual !== expected) {
            throw new Error(`Assertion Failed: Expected ${expected}, got ${actual}`);
        }
    });

    // Load blocks
    for (const block of blocks) {
        this.forth.interpret(block + "\n");
    }

    this.isReady = true;
  }

  run(cmd: string): string {
    const start = this.output.length;
    this.forth.interpret(cmd + "\n");
    return this.output.substring(start).trim();
  }

  getMemory() {
      return this.forth.memory().buffer;
  }
}
