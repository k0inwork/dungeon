<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Aethelgard

> "The Terminal is the World."

Aethelgard is a high-performance, neuro-symbolic roguelike engine that bridges the gap between modern web technologies and classic low-level logic execution.

The project **tends to be** an infinitely generative, logic-rich simulation where AI-driven "hallucinations" (lore, entities, and abilities) are instantly transpiled into executable low-level mechanics. **Now it is** a robust, high-performance roguelike framework utilizing a hybrid architecture of React 19 for the host environment and WAForth (WebAssembly) for its independent logic kernels.

## 🪐 Architecture: Star Topology

The engine is built on a **Star Topology** where a JavaScript Host acts as a central router and scheduler for several independent Processing Nodes (Kernels).

- **JS Host**: Handles rendering (React 19), input, AI integration, and inter-kernel message routing.
- **Processing Nodes (Kernels)**: Independent WAForth instances executing specialized game logic.
    - **Grid Kernel**: Handles physics, spatial indexing (O(1) entity lookups), and environmental updates.
    - **Hive Kernel**: Manages entity AI and behavior patterns.
    - **Player Kernel**: Processes player state, inventory, and input mapping.
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
- `src/`: Core source code (React components, Forth kernels, Aether transpiler).
- `design/`: Detailed system specifications and architecture designs.
- `doc/`: Project analysis, design bible, and roadmap documentation.
- `imp/`: Implementation details and specific module documentation.
- `test-results/`: Execution traces and artifacts from integration tests.

## 🔗 External Resources

- **WAForth**: [GitHub - remko/waforth](https://github.com/remko/waforth)
- **React**: [react.dev](https://react.dev/)
- **Vite**: [vite.dev](https://vite.dev/)
- **TypeScript**: [typescriptlang.org](https://www.typescriptlang.org/)
- **Acorn**: [GitHub - acornjs/acorn](https://github.com/acornjs/acorn)
- **Google Gemini API**: [ai.google.dev](https://ai.google.dev/)
- **Vitest**: [vitest.dev](https://vitest.dev/)
