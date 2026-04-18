# Engineering memo: vessel orchestrator refactor — memorial summary

**Status:** Project closeout narrative (not a stage plan)  
**Audience:** Engineers and reviewers; anyone planning a similar split between domain logic and Convex integration  
**Date:** 2026-04-17

---

## Purpose

This document **memorializes** the vessel orchestrator work that separated **domain** from **database and orchestration**, and aligned **imports** with stricter **module-boundary** policy. It states **before vs after** at a useful level of generality, **why** we did it, **how to reuse the approach** elsewhere, and **loose ends** that remain optional.

**Deeper references** (preserved detail, handoffs, and ongoing policy):

- [`imports-and-module-boundaries-memo.md`](imports-and-module-boundaries-memo.md)
- [`vessel-orchestrator-functions-owned-orchestration-memo.md`](vessel-orchestrator-functions-owned-orchestration-memo.md)
- [`vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md)
- [`docs/handoffs/`](../handoffs/) — step and phase artifacts for this project

---

## Before (starting format)

**Layering.** The public orchestrator action called a **domain-level tick runner** that owned **orchestration** (parallel branches, ordering, aggregation) while **persistence** was expressed as **injected callbacks** from the functions layer. Tick **result types** lived under **`convex/domain`**, beside business helpers. That split was test-friendly in isolation but blurred **who owns Convex** and **who owns the tick story**.

**Domain vs DB.** Trip and timeline paths had already moved toward **plans and projections** in places, but **writes and `ActionCtx`** still appeared **inside** domain modules in the trip lifecycle. The overall picture mixed **pure-ish compute**, **I/O-shaped seams**, and **orchestration** without a single obvious home for each.

**Imports.** Callers in **`convex/functions/vesselOrchestrator`** often reached **deep paths** into `convex/domain/vesselOrchestration/...` leaf files. That coupled the orchestrator to **file layout**, made the **intended public contract** of each subfolder unclear, and made refactors noisier than they needed to be.

---

## After (ending format)

**Layering.** **`convex/functions/vesselOrchestrator`** owns the **tick**: `ActionCtx`, **`Promise.allSettled`** between location and trip branches, sequencing inside the trip stack, metrics, logging, and **all** Convex writes (locations, trips, timeline). **`convex/domain/vesselOrchestration`** exposes **pure or read-port-only** helpers: eligibility, plans, projection inputs, assemblers — **no** orchestration runner, **no** tick dependency bag, **no** tick contracts owned by domain.

**Contracts.** Orchestrator tick **input/result types** live next to the action implementation (e.g. `functions/vesselOrchestrator/types.ts`). The domain root **façade** was trimmed so it no longer pretends to be the tick’s public API.

**Imports.** **`functions/vesselOrchestrator`** imports peer domain work through **folder entry files** (`index.ts` and the small set of agreed roots), not arbitrary internal paths. **Biome `noRestrictedImports`** guards the orchestrator glob against regressions into the deepest paths under the main peer subtrees; tests share that rule unless a documented exception applies.

---

## Chronology (major moves)

The refactor landed in **two beats**; both aimed at the same separation: **what should happen** (domain) vs **how Convex runs and mutates** (functions).

**Beat A — persistence, write plans, and wiring in `functions/`.** Trip lifecycle work shifted toward **producing write plans** in domain while **applying** those plans moved to **`convex/functions/vesselTrips`** (`applyVesselTripTickWritePlan`) and orchestrator glue. A **`createVesselOrchestratorTickDeps`** module briefly centralized wiring (bulk locations, trip processing with default deps, scheduled-segment lookup, prediction access, timeline `applyTickEventWrites`) with its own unit test. ML prediction gained an explicit **model access** abstraction so domain prediction code does not take **`ActionCtx`** directly. Slimmer read-model/bootstrap paths replaced earlier domain bootstrap helpers where appropriate.

**Beat B — tick ownership and simpler composition.** The **domain** tick runner (`runVesselOrchestratorTick`), domain-hosted orchestrator **tick types**, and the **deps factory** were **removed**. Post-fetch tick orchestration lives in **`executeVesselOrchestratorTick`**, with **types** and helpers (`vesselOrchestratorTickHelpers`, `createScheduledSegmentLookup`, etc.) beside that entry; wiring is **composed inline** at the tick entry instead of a separate dependency-bag abstraction. Domain **`processVesselTrips`** emphasizes **`computeVesselTripTickWritePlan`–style** output; **`runProcessVesselTripsTick`** applies the write plan and ties in **`buildTimelineTickProjectionInput`** for timeline. Large tick tests and fixtures moved to **`convex/functions/vesselOrchestrator/tests/`** so coverage sits next to the owning layer. An earlier **`functions/vesselOrchestrator/index.ts`** barrel was removed so Convex registration stays explicit.

**Docs and policy.** Engineering memos, handoffs, and README/architecture updates under **`docs/engineering/`**, **`docs/handoffs/`**, **`convex/domain/vesselOrchestration`**, and **`convex/functions/vesselOrchestrator`** recorded **intent**, **import rules**, and **ownership** alongside the code moves.

---

## Why (high level)

- **Separation of concerns.** Business rules and data shapes should stay **stable and testable** without dragging in scheduling, metrics, or mutation wiring. Convex integration belongs beside **`ctx`**, not inside “domain” modules that are supposed to describe **what** should happen, not **how** the runtime applies it.

- **Clear ownership.** One place names the **orchestration story**; domain folders stay **honest** about being **compute and contracts for compute**, not hidden orchestrators.

- **Refactor safety and readability.** **Folder-as-module** imports mean a designed **public surface** per feature folder. Callers depend on **intent**, not on whichever internal file happened to export a symbol last week.

- **Consistency for people and automation.** The same simple rule — **outside the folder, import the entry** — works for reviews, refactors, and linters.

---

## Guidance for similar refactors (other folders)

1. **Separate “what to do” from “how to run it.”** Move **`ctx`**, parallelism, and mutation application **up** into `functions/` (or an adapter layer), and keep domain outputs as **plans, rows, or small value objects**.

2. **Move types with the owning behavior.** If only the action and its tests care about a tick’s **wire format**, that contract should live **next to the action**, not in domain by default.

3. **Fix import boundaries early or in dedicated passes.** Prefer **peer `index.ts`** imports before growing **barrel dumps**. If widening an entry file feels wrong, that is a signal to **split a submodule** with its own story, not to paste every leaf export into one file.

4. **Stage risky moves.** Keep behavior parity explicit; run **check, typecheck, and Convex typecheck** after each coherent step.

5. **Automate last.** Once paths stabilize, **lint** the worst regressions (restricted imports) for the heaviest consumers.

---

## Loose ends (optional, not blockers)

- **Module shape (Step H).** The **`updateVesselTrips`** entry may stay **large** by design for discoverability; a future split (e.g. tick pipeline vs eligibility façades) is **optional** if onboarding or review friction appears.

- **Lint coverage.** The **`noRestrictedImports`** override is **orchestrator-scoped**; mirroring it for other heavy consumers (e.g. `functions/vesselTrips`) remains an **optional** follow-up.

- **Broader adoption.** Repo-wide **Stage E** in the imports memo (reviews and optional tightening) continues **incrementally** outside this project.

- **Environment noise.** Local **Biome** runs may still warn about **dereferenced symlinks** under `ios/Pods` on some machines; CI that scopes checks may not see the same — treat as **environment**, not as a flaw in the boundary rules.

---

## Document history

- **2026-04-17:** Initial memorial memo; added chronology (two-beat narrative, factory removal, tests/docs); unwrapped paragraph line breaks.
