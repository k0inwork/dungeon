<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Aethelgard

## 🌌 Ideology: The Terminal is the World

Aethelgard is founded on the principle that complexity should arise from simple, symbolic foundations. We reject high-fidelity graphics in favor of the **Glyph**.

- **The World is a Grid:** Every entity, environmental hazard, and lore element is expressed as a character in a grid.
- **The Glyph as an Interface:** By reducing the world to a `{ symbol: string, color: string }` definition, we bridge the gap between AI and mechanics. An AI can "hallucinate" a red dragon, and the engine renders it instantly as a red `D`, complete with transpiled combat logic.
- **The Coprocessor Model:** We maintain a strict separation between the **Host** (JavaScript/React) for rendering and orchestration, and the **Guest** (WebAssembly/Forth) for the immutable laws of physics and logic.

### 🌓 Vision vs. Reality
The project **tends to be** an infinitely generative, logic-rich simulation where a hierarchy of playable **Manifolds** (from roguelike dungeons to platformer corridors and text-based MUD journeys) are seamlessly bridged by AI-driven mechanics.

**Now it is** a robust, high-performance roguelike framework utilizing a hybrid architecture of React 19 for the host environment and WAForth (WebAssembly) for its independent logic kernels. It successfully implements the **Star Topology** for kernel orchestration and handles both event-driven (Grid) and real-time (Platformer) simulation manifolds.

## 🪐 Architecture: The Multilevel Manifold

Aethelgard treats the world as a **Rhizome**—a unified graph of active manifolds where "Nodes" (locations) and "Links" (journeys) are both playable spaces.

### 🛰️ The Star Topology
The engine operates on a **Star Topology** where the JavaScript Host acts as a central router/scheduler for independent Processing Nodes (Kernels).

- **JS Host**: Handles rendering (React 19), input, AI integration, and inter-kernel message routing.
- **Independent Kernels**: Specialized WAForth instances executing logic for different manifolds:
    - **Grid Kernel (`ORTHOGONAL` / `GAUNTLET`)**: The spatial source of truth. Handles physics, spatial indexing (O(1) entity lookups), and environmental updates.
    - **Gravity Kernel (`GRAVITY`)**: Real-time side-scrolling physics for vertical traversal.
    - **MUD Kernel (`ABSTRACT`)**: Text-based narrative bridges for abstract travel and skill checks.
    - **Hex Kernel (`TACTICAL`)**: Large-scale skirmishes and elevation-aware strategy.
    - **Hive Kernel**: Manages entity AI and behavior patterns.
    - **Player Kernel**: Processes player state, inventory, and intent parsing.
    - **Battle Kernel**: Manages RPG stats, combat logic, and status effects.

## 🛠️ Core Technologies

### Aether Transpiler (AJS to Forth)
Aethelgard features **Aether**, a custom transpiler that allows developers to write kernel logic in a subset of JavaScript (AJS) and compile it directly into optimized Forth code for the kernels.

### AIKP Protocol
The **Aethelgard Inter-Kernel Protocol** is a lightweight, 24-byte packet-based messaging system that enables seamless communication between kernels via the JS Host router.

### Virtual Shared Objects (VSO)
Cross-kernel data access is achieved through the **VSO system**, which synchronizes memory regions across kernels using host-mediated sync calls, ensuring data consistency while maintaining kernel isolation.

### Unified Terminal Rendering
The engine uses a **Unified Terminal** style, relying on ASCII/Unicode glyphs rendered via a shared memory Canvas buffer for a classic yet responsive roguelike feel.

### AI-Driven Procedural Generation
Integrates with the **Gemini API** via the `GeneratorService` for dynamic world, lore, and entity generation based on user-provided seeds.

## 🚀 Getting Started

### Prerequisites
- Node.js (Latest LTS recommended)

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your `VITE_GEMINI_API_KEY` in `.env.local`:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```
   *(Note: The engine will use a Mock generator if no API key is provided)*

### Run Locally
```bash
npm run dev
```

## 🧪 Testing
The project includes a suite of tests for kernels and integration.
- **Run all tests**: `npm test`
- **Run kernel tests**: `npm run test:kernels`
- **Run integration tests**: `npm run test:integration`

## ⚙️ Tech Stack
- **Frontend**: React 19, TypeScript, Vite
- **Logic**: [WAForth](https://github.com/remko/waforth) (WebAssembly Forth)
- **Compiler**: [Acorn](https://github.com/acornjs/acorn) (for AJS parsing)
- **AI**: [Google Generative AI (Gemini)](https://ai.google.dev/)

## 📂 Project Structure

Aethelgard uses a decoupled, kernel-based architecture. Data flows through a central **Star Topology** router via a **Double-Queue** (Inbox/Outbox) mechanism.

### 🧩 Core Directories
- `src/`: The main application source.
    - `kernels/`: WAForth logic kernels (Grid, Hive, Player, Battle).
    - `compiler/`: The **Aether Transpiler** (AJS to Forth).
    - `services/`: Core engine services (WaForth, Generator, MapGen).
    - `systems/`: Host-side systems (Platformer Physics, Animation).
    - `components/`: React UI components (Terminal Canvas, Architect View).
- `design/`: Technical specifications for the engine's subsystems (Architecture, WASM, Scheduling).
- `doc/`: Philosophical and strategic documentation (Design Bible, Roadmap, Project Analysis).
- `imp/`: Detailed implementation logs and phase-by-phase development guides.

### 🛰️ The Kernels
- **Grid Kernel (`src/kernels/GridKernel.ts`):** The spatial source of truth. Handles physics, collision, and environmental cycles.
- **Hive Kernel (`src/kernels/HiveKernel.ts`):** The AI brain. Manages entity decision-making and behavior patterns.
- **Player Kernel (`src/kernels/PlayerKernel.ts`):** The user's proxy. Manages player stats, inventory, and intent parsing.
- **Battle Kernel (`src/kernels/BattleKernel.ts`):** The combat logic engine. Manages RPG stats, damage calculation, and status effects.

### 🧪 Integration & Traces
- `test-results/`: Contains detailed execution traces from multi-kernel integration tests, ensuring logic consistency across the star topology.

## 🔗 External Resources

- **WAForth**: [GitHub - remko/waforth](https://github.com/remko/waforth)
- **React**: [react.dev](https://react.dev/)
- **Vite**: [vite.dev](https://vite.dev/)
- **TypeScript**: [typescriptlang.org](https://www.typescriptlang.org/)
- **Acorn**: [GitHub - acornjs/acorn](https://github.com/acornjs/acorn)
- **Google Gemini API**: [ai.google.dev](https://ai.google.dev/)
- **Vitest**: [vitest.dev](https://vitest.dev/)
