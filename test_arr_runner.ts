import { AetherTranspiler } from './src/compiler/AetherTranspiler.ts';
import * as fs from 'fs';
const src = fs.readFileSync('test_arr.js', 'utf8');

console.log(AetherTranspiler.transpile(src, 0));
