
import { PLATFORM_AJS_SOURCE } from "./src/kernels/PlatformKernel.ts";
import { AetherTranspiler } from "./src/compiler/AetherTranspiler.ts";
import { KernelID } from "./src/types/Protocol.ts";

const output = AetherTranspiler.transpile(PLATFORM_AJS_SOURCE, KernelID.PLATFORM);
console.log(output);
