# AETHELGARD ENGINE: USER EXPERIENCE PROTOCOLS (v1.0)

> **Design Philosophy:** "The Console of the Demiurge."
> **Visual Identity:** Retro-Industrial, CRT Phosphor, Monospace, Data-Dense.
> **Core Loop:** Seed -> Curate -> Simulate -> Inspect.

---

## 1. THE GENESIS FLOW (World Creation)

The entry point of the application. This is a linear wizard that guides the user from a blank void to a fully simulated world.

### Stage 1: The Seed (Input)
*   **UI Element:** A large, blinking cursor text input centered on a black screen.
*   **Prompt:** "DEFINE WORLD PARAMETERS >"
*   **Interaction:** User types a thematic seed (e.g., "Post-Apocalyptic Samurai in a fungal wasteland").
*   **Action:** Press [ENTER] to initialize.

### Stage 2: The Codex (Lore Curation)
*   **Transition:** The screen splits. Left side shows "Neural Handshake...".
*   **Display:** The AI streams the generated `WorldTheme` and `Lore` text into a centralized editor.
*   **Interaction (The Feedback Loop):**
    *   The text is **Editable**. The user can delete "Fungal" and type "Radioactive".
    *   **Button [REGENERATE]:** Sends the *edited* text back to the AI to hallucinations/expand based on user tweaks.
    *   **Button [CONFIRM]:** Locks the Lore as "Canon" and triggers the Snowball.

### Stage 3: The Snowball (Automated Construction)
Once Lore is confirmed, the UI shifts to a **System Log** visualization. The user does not interact here; they observe the creation.
*   **Visuals:** Rapid scrolling text, progress bars, and "Matrix-style" data streams.
*   **Log Stream:**
    *   `> GENERATING PHYSICS... [DONE]`
    *   `> DEFINING RACE: MUTANT SAMURAI... [DONE]`
    *   `> DEFINING CLASS: RONIN... [DONE]`
    *   `> COMPILING SCRIPT: 'Katana Slash'... [OK]`
    *   `> CRUCIBLE CHECK: Script 'Seppuku' failed validation. Retrying... [FIXED]`
*   **Persistence:** Upon completion, the state is automatically serialized to Firebase under `current_save`.

---

## 2. THE DUAL VIEWPORTS

Once generation is complete, the user enters the main engine. The UI has a global **Toggle Switch** (Top Right): `[ PLAY | ARCHITECT ]`.

### 2.1 The Player View (The Simulation)
Focused on immersion and gameplay.
*   **Viewport:** The rendered Wasm Grid/Graph (Canvas).
*   **HUD:** Minimalist.
    *   *Bottom Left:* Scrolling Combat Log (Text).
    *   *Bottom Right:* Inventory & Status (Simple numbers/icons).
    *   *Controls:* Click-to-move or Keyboard.
*   **Aesthetics:** Scanlines, vignette, chromatic aberration.

### 2.2 The Architect View (The God Eye)
Focused on data inspection and debugging.
*   **Layout:** Dashboard style (Grid of Panels).
*   **Panel A: Taxonomy Browser:** Tree view of Races, Classes, Origins. Clicking one reveals the JSON data and associated Scripts.
*   **Panel B: The Atlas:** A node-graph visualization of the entire world topology (Sectors -> Nodes -> Links).
*   **Panel C: Entity Inspector:** Real-time table of every active entity in memory, their coordinates, HP, and current AI State.
*   **Panel D: State Editor:** Ability to manually edit values (e.g., change User Gold from 10 to 10000) and inject back into Wasm.

---

## 3. THE AETHER IDE (Developer Console)

Accessible via a persistent `[ >_ ]` FAB (Floating Action Button) in the bottom-right corner, or the `~` (Tilde) hotkey. It opens a semi-transparent overlay.

### Tab 1: TERM (The Forth Console)
*   **Role:** Direct communication with the Wasm Engine.
*   **Interaction:**
    *   Input: `10 20 + .`
    *   Output: `30 ok`
*   **Use Case:** Low-level debugging, checking stack depth, memory peeking.

### Tab 2: TRANSPILER (The Playground)
*   **Role:** Testing the Polyglot Compiler.
*   **Left Pane:** JS/Python Input.
*   **Right Pane:** Forth Output.
*   **Action:** As user types, the Right Pane updates in real-time. If errors occur (Crucible check), the line highlights red.

### Tab 3: LABORATORY (The Simulation Chamber)
*   **Role:** Unit Testing Game Logic without playing.
*   **UI:**
    *   *Subject:* Select a Script (e.g., "Fireball").
    *   *Context:* Select Caster (Level 1 Mage) and Target (Level 1 Goblin).
    *   *Action:* [RUN SIMULATION].
*   **Output:** A detailed breakdown of the frame:
    *   `[TICK 0] Script Loaded.`
    *   `[TICK 1] Variable 'dmg' set to 10.`
    *   `[TICK 2] Affinity Check: Fire vs Ice (2.0x).`
    *   `[TICK 3] Target HP: 10 -> -10.`
    *   `[RESULT] Target Died.`

---

## 4. SYSTEM CONFIGURATION

Accessed via a "Gear" icon in the global header.

### 4.1 Connectivity
*   **Firebase Config:** Input fields for API Key, Auth Domain, Database URL. (Stored in LocalStorage).
*   **LLM Router:**
    *   *Cloud:* Google Gemini API Key.
    *   *Local:* WebLLM Model Selection (e.g., Llama-3-8B-Quantized).
    *   *Routing Rules:* Toggle specific tasks (e.g., "Use Local for NPC Chat", "Use Cloud for World Gen").

### 4.2 Engine Tuning
*   **Animation Speed:** Slider (1x to 100x).
*   **Graphics Quality:** Toggle WebGPU Shaders (CRT effects, Lighting).
*   **Audio:** Music/SFX volume (Generated Audio eventually).

---

## 5. USER JOURNEY SUMMARY

1.  **Config:** User sets API keys.
2.  **Creation:** User types "Cyberpunk London".
3.  **Refining:** User tweaks Lore text.
4.  **Wait:** System matrices code.
5.  **Inspect:** User switches to **Architect View** to see what monsters were created.
6.  **Play:** User switches to **Player View** to explore.
7.  **Crash:** A bug occurs.
8.  **Debug:** User opens **Aether IDE**, fixes the script in the **Laboratory**, and continues playing.
