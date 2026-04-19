# Engineering memo: module boundaries, imports, and exports

**Status:** Adopted policy (incremental enforcement)  
**Audience:** Engineers, reviewers, and coding agents  
**Scope:** TypeScript across the repo (Convex domain, `functions/`, `shared/`, app code). Layer-specific rules (e.g. domain vs Convex entrypoints) sit **on top** of these defaults.

---

## 1. Summary

We treat each **folder** as a **single logical module**: a small **public surface** and **internal implementation** that stays private. The public surface is exposed through **one entry file** per folder (typically `index.ts`). Callers outside the folder import **only** from that entry, not from internal files.

This is **not** “barrels for shorter paths.” A good entry file is a **designed API** (often one primary operation plus the types and helpers that belong to its contract). A bad entry file re-exports everything in the tree for convenience—that is a **barrel dump** and we avoid it.

**Vessel trip tick (current code vs target migration):** In the **current** code, trip pipeline types and `computeVesselTripsBundle` live behind [`convex/domain/vesselOrchestration/updateVesselTrips/index.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/index.ts), while orchestrator persistence helpers still sit behind [`orchestratorTick`](../../convex/domain/vesselOrchestration/orchestratorTick/index.ts). For the active tree migration, follow [`docs/vessel-orchestrator-prd/vessel-orchestration-next-work-prd.md`](../vessel-orchestrator-prd/vessel-orchestration-next-work-prd.md): do **not** add new long-lived consumers of `orchestratorTick/` or `tickLifecycle/`; move toward `shared/` + `update*/index.ts` surfaces instead.

---

## 2. Preferences

- **One main story per folder.** The folder implements one coherent capability. A “main” module (the primary exports) may include more than one function if they form a single abstraction.
- **One entry point.** `index.ts` (or an explicitly documented equivalent) is the **only** supported import path **from outside the folder**.
- **Internals stay internal.** Other files in the folder are implementation details. They may import each other freely using **relative** paths or clear local conventions.
- **Peer modules use peer façades.** Code in folder A that needs folder B imports **`B/index.ts`**, not `B/internal/...`.
- **Stability at the boundary.** Refactors inside a folder should not force churn outside it unless we **choose** to change the public API.

---

## 3. Concerns (why this matters)

- **Readability.** When imports fan out to many deep paths (`.../tripLifecycle/foo`, `.../processTick/bar`), readers cannot tell what the **contract** of a feature is or which dependencies are intentional.
- **Refactor safety.** Deep imports couple callers to **file layout**. Moving or splitting an internal file should not break the rest of the codebase.
- **Consistency for humans and agents.** Mixed rules (“sometimes index, sometimes six levels deep”) produce accidental APIs and noisy diffs. Automated tools also behave better when the rule is simple: **outside the folder → entry file only**.
- **Barrel dumps masquerading as modules.** An `index.ts` that re-exports every helper blurs public vs private and encourages everything to become “public by accident.”

---

## 4. Import rings (general pattern)

These rings apply in spirit across layers; exact paths depend on the area (e.g. `convex/domain/...` vs `src/features/...`).

| Ring | Typical scope | Rule |
|------|----------------|------|
| **External** | Code **outside** the folder | Import **only** from that folder’s **entry file** (or a small set of **documented** roots, e.g. a package-level type module). |
| **Peer** | Another folder at the same level of abstraction | Import **only** from the **peer’s entry file**, never peer internals. |
| **Internal** | Files inside the same folder | Relative imports between implementation files; no requirement to route through `index.ts` for same-module plumbing. |

**Judgment (not mechanical):** If a symbol is needed outside the folder, add it to the **entry file** deliberately. If it is only needed for tests of internals, tests may import internals only under agreed rules (e.g. colocated `tests/`), documented per area.

---

## 5. Exports: what belongs on the entry file

Use these prompts:

1. Would a **caller outside this folder** need this symbol to use the module’s **primary behavior** correctly?
2. Is this symbol part of a **stable contract** (types, options, result shapes) for that behavior?
3. If we moved or renamed an internal file, should **external** code break? If not, the symbol does not belong on the public entry.

**Explicit non-goal:** The entry file does not need exactly **one** export. It needs a **coherent** set. Multiple related exports are fine; unrelated grab-bags are not.

---

## 6. Stages to incorporate these practices

Work is **incremental**. Order below minimizes risk and keeps typecheck green.

### Stage A — Document and align (done when this memo lands)

- Record the policy (this memo) and link it from the main domain / Convex README or agent instructions so it is not only in a single optional file.
- Agree on **lint direction** (Stage D) even if rules are not enabled yet.

### Stage B — Fix cross-module boundaries first

- Within each feature tree, ensure **peer folders** import each other via **`index.ts`**, not deep paths.
- Adjust **entry files** so they re-export from **peer entry files** where composition is intentional (e.g. one module’s façade forwarding a narrow set of types from another)—rather than re-exporting from a peer’s **internal** file paths.

### Stage C — Fix external callers (e.g. `convex/functions/`, app layers)

- Replace deep imports into another package with imports from that package’s **entry file**.
- Extend the entry file **only** when a legitimate external need appears (pressure to keep the public API small and honest).

### Stage D — Automate enforcement

- Add **lint rules** (e.g. `no-restricted-imports` or path-based rules) for the worst regressions: e.g. forbid `functions/**` from importing known internal glob patterns under `domain/**`.
- Tighten rules as coverage improves; prefer **allowlists** of entry paths where ambiguity is high.
- **Partial (2026-04-17):** Biome `style/noRestrictedImports` is enabled for
  `convex/functions/vesselOrchestrator/**/*.ts` in [`biome.json`](../../biome.json)
  (`overrides`): that glob **includes tests** under `functions/vesselOrchestrator`.
  Deep imports under
  `domain/vesselOrchestration/updateVesselTrips/**`,
  `domain/vesselOrchestration/updateTimeline/**`, and
  `domain/vesselOrchestration/updateVesselPredictions/**` are errors; peer entry
  imports (no extra path segment) remain valid. If a test **must** deep-import
  with a documented reason, use a targeted `biome-ignore` on that import (and
  explain why) or narrow the override—same escape hatch as other exceptions
  above.
- **Optional follow-up:** Mirror the same `noRestrictedImports` pattern for other
  heavy domain consumers (e.g. `convex/functions/vesselTrips/**/*.ts`) so
  `functions/vesselTrips` tests cannot regress to deep `domain/...` paths—not
  required for the vessel-orchestrator milestone; `vesselTrips` tests were aligned
  to peer entries separately.
- **Local `bun run check`:** Warnings about **dereferenced symlinks** under
  `ios/Pods` are an environment / CocoaPods layout issue on some machines; CI that
  scopes Biome to app and Convex paths may not hit them. If check fails only on
  those entries, confirm whether your job includes `ios/Pods` and exclude or fix
  Pods symlinks as appropriate for that pipeline.

### Stage E — Ongoing

- New code reviews use this memo as a **checklist**.
- When a deep import is **truly** required (rare), document **why** in code or in a short ADR-style note.

---

## 7. Relationship to layer-specific rules

- **Convex `domain/` vs `functions/`:** Domain holds business rules; `functions/` holds Convex registration and `ctx`. Domain must not depend on function **implementations**; that rule is unchanged. **Import boundary** rules here define **how** `functions/` may depend on **domain modules** (via their entry files only).
- **Frontend / features:** The same folder-as-module idea applies: feature folders expose a deliberate API; avoid importing another feature’s internals from `src/features/B/internal/...`.

---

## 8. Document history

- **2026-04-18:** Trip tick pointer — canonical `updateVesselTrips` / `orchestratorTick` imports vs legacy `orchestratorPipelines` naming in older docs.
- **2026-04-17:** Initial memo (imports, exports, staged adoption).
- **2026-04-17:** Stage D — document Biome `noRestrictedImports` override for
  `functions/vesselOrchestrator` (post–Step G closeout).
- **2026-04-17:** Stage D — clarify test scope, `biome-ignore` escape hatch,
  optional `vesselTrips` mirror, and local `check` vs `ios/Pods` symlinks.
