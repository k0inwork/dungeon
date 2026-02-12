# IMPLEMENTATION PHASE 5: THE GENERATOR

## 1. OBJECTIVE
Implement the "Snowball" generation pipeline using Gemini API.

## 2. STRUCTURE
Create `src/services/GeneratorService.ts`.

### 2.1 The Prompt Templates
Store in `src/prompts/`.
*   `SystemPrompt.ts`: "You are the Aethelgard Engine..."
*   `TaxonomyInjection.ts`: "Here is the schema for Races..."

### 2.2 The Fetcher
Use `@google/genai`.

```typescript
async function generateWorld(theme: string) {
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent({
      contents: [ ... ],
      generationConfig: { responseMimeType: "application/json" }
  });
  return JSON.parse(result.response.text());
}
```

### 2.3 The Pipeline
Implement `generateFullSimulation(theme)`:
1.  **Stage 1:** Generate Lore/Theme.
2.  **Stage 2:** Generate Map Layout (ASCII Array).
3.  **Stage 3:** Generate Entities (Taxonomy + Scripts).
4.  **Stage 4:** Transpile Scripts (Validation).
    *   If valid: Inject into Wasm.
    *   If invalid: Flag for user review.

## 3. ERROR HANDLING
Wrap all AI calls in try/catch blocks that return structured `GenerationResult` objects (Success/Failure states) to the UI.
