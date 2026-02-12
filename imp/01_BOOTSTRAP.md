# IMPLEMENTATION PHASE 1: BOOTSTRAP

## 1. OBJECTIVE
Initialize the WAForth interpreter within the React application and establish a bi-directional communication channel (Logging and Error handling).

## 2. DEPENDENCIES
*   `waforth`: The Wasm-based Forth interpreter.

## 3. STEPS

### 3.1 Install WAForth
Since we are using ESM imports in `index.html`, ensure `waforth` is available in the import map or downloaded to `public/lib/`.
*   *Action:* Update `index.html` import map to include `"waforth": "https://esm.sh/waforth@0.16.0"`.

### 3.2 Create `src/services/WaForthService.ts`
This singleton manages the Wasm instance.

```typescript
import WAForth from "waforth";

class WaForthService {
  forth: WAForth;
  isReady: boolean = false;

  async boot() {
    this.forth = new WAForth();
    
    // Bind output to Console
    this.forth.onEmit = (c) => processChar(c); 
    
    await this.forth.load();
    
    // Bind Custom JS Words
    this.forth.bind("JS_LOG", (ptr, len) => {
      const str = this.readString(ptr, len);
      console.log(`[WASM] ${str}`);
    });

    this.isReady = true;
  }

  readString(ptr: number, len: number): string {
    const mem = new Uint8Array(this.forth.memory.buffer);
    return new TextDecoder().decode(mem.subarray(ptr, ptr + len));
  }
}
```

### 3.3 Create the Kernel Loader
Create `src/services/KernelLoader.ts`.
*   Function: `loadKernel(url: string)`
*   Logic: `fetch(url).then(text => forth.interpret(text))`

### 3.4 Sanity Check (The "Hello World")
In `App.tsx`, inside `useEffect`:
1.  Boot Service.
2.  Run: `forth.interpret('S" Aethelgard Online" JS_LOG');`
3.  Verify Console Output.
