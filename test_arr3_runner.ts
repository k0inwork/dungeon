import { AetherTranspiler } from './src/compiler/AetherTranspiler.ts';
const js = `
function test_array() {
    let arr = [10, 20];
    arr.push(30);
    return arr.pop();
}
`;
console.log(AetherTranspiler.transpile(js, 0));
