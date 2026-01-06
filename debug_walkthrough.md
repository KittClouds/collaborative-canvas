# Debugging Unified Relations Pipeline: Walkthrough & System Explanation

## 1. Context & Objective
The goal was to fix the **Unified Relations** extraction pipeline, which was reporting `0` unified relations in production despite passing unit tests. This pipeline extracts Subject-Verb-Object (SVO) relationships from text using Rust-based Constituent Syntax Tree (CST) analysis and graph inference.

## 2. The Problem
**Symptoms:**
- Frontend logs showed `implicit: 30+, unified: 0`.
- Unit tests for `RelationEngine` passed in Rust.
- "Time not implemented" panic observed in browser console after partial fixes.

**Root Causes:**
1.  **WASM Build Misconfiguration:** The project had two competing WASM build locations.
    - `package.json` built to: `src/lib/wasm/kittcore`
    - `vite.config.ts` loaded from: `rust/kittcore/pkg`
    - Result: The browser was loading **stale WASM** binaries, ignoring all code changes.
2.  **Rust Runtime Panic:** The usage of `std::time::Instant` caused a panic in the WASM environment (which doesn't support standard OS time syscalls), silently failing the extraction thread in some paths.

## 3. Step-by-Step Fixes

### Phase 1: Diagnostics & Logging
- **Traced Data Flow:** Mapped the path from `ConductorBridge` (TS) → `ScanConductor` (Rust) → `DocumentCortex`.
- **Added Debug Logs:** Inserted `[WASM]` and `[SVO Debug]` logs into `document.rs` and `structured_relation.rs`.
- **Discovered Stale Build:** Noticed logs weren't appearing despite successful builds. Traced `package.json` vs `vite.config.ts` discrepancy.

### Phase 2: Configuration & Code Fixes
1.  **Fixed Build Target**: Updated `package.json` script:
    ```json
    "build:wasm": "cd rust/kittcore && wasm-pack build --target web --out-dir pkg"
    ```
    This aligned the build output with where Vite/Webpack looks for the module.

2.  **Fixed Time Panic**:
    - Replaced `std::time::Instant::now()` with `instant::Instant::now()` (from the `instant` crate) in `relation.rs`.
    - This ensures cross-platform compatibility (WASM + Native).

3.  **Refined Debug Logging**:
    - Simplified debug macros to explicit `wasm_bindgen::JsValue::from_str` to avoid type inference issues during logging.

### Phase 3: Verification
- **Rebuilt WASM**: `npm run build:wasm`
- **Observed Logs**:
    ```
    [SVO] VPs:21 entities:39
    [SVO] VP 'killed' sent:888-946 subj:true obj:true
    [SVO] VP 'mentors' sent:979-1016 subj:true obj:true
    ...
    ```
- **Result**: 5+ high-quality unified relations extracted from the test document (e.g., "killed", "loves", "fought").

## 4. System Explanation (How it Works Now)

The **Unified Relations Pipeline** operates in the following layers:

### Layer 1: Implicit Entity Detection (Phase 2)
- **Engine**: `ImplicitCortex` (Aho-Corasick automaton)
- **Input**: Raw text
- **Output**: ~30-40 implicit mentions (e.g., "Luffy", "Wano")
- **Role**: Feeds entity spans into the next layer.

### Layer 2: CST Projection (Phase 7 - The "Unified" Part)
- **Engine**: `RelationEngine` -> `StructuredRelationExtractor`
- **Mechanism**:
    1.  **Chunking**: Splits sentences into Noun Phrases (NP), Verb Phrases (VP), and Prepositional Phrases (PP).
    2.  **SVO Matching**: For every VP, looks for:
        - **Subject**: Nearest entity *before* the verb within sentence bounds.
        - **Object**: Nearest entity *after* the verb within sentence bounds.
    3.  **Filtering**: Discards patterns without valid subjects.
- **Output**: `UnifiedRelation` objects (e.g., `Luffy -> DEFEATED -> Kaido`).

### Layer 3: Persistence
- **Bridge**: `ConductorBridge` marshals these Rust structs into TypeScript.
- **Storage**: `ExtractorFacade` persists them into the `RelationshipRegistry` (CozoDB/SQLite).

## 5. Deployment Status
- **Local**: Fully functional and verified.
- **Remote `origin`**: Pushed to `GraphAite-tester`.
- **Remote `daswundebar`**: Pushed to `GraphAite-tester`.

The system is now correctly extracting complex semantic relationships from narrative text purely in the client-side WASM environment.
