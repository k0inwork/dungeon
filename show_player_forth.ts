
import { AetherTranspiler } from "./src/compiler/AetherTranspiler.ts";
import { PLAYER_AJS_SOURCE } from "./src/kernels/PlayerKernel.ts";
import { KernelID } from './src/types/Protocol.ts';

console.log(AetherTranspiler.transpile(PLAYER_AJS_SOURCE, KernelID.PLAYER));
