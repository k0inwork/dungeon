import { AetherTranspiler } from './src/compiler/AetherTranspiler.ts';
import * as fs from 'fs';
const js = `
function test_array() {
    let arr = [10, 20];
    arr.push(30);
    let v1 = arr.pop();
    let v2 = arr.pop();
    return v1 + v2;
}
`;
console.log(AetherTranspiler.transpile(js, 0));
