# Handoff: WSF identity + topology adapter extractions

**Date:** 2026-04-16  
**Audience:** implementation agent  
**Superseded layout:** WSF adapters now live under `convex/adapters/fetch/`, `resolve/`, `pipelines/`, and `utils/` with names like `fetchWsfVesselLocations.ts` — see **`docs/handoffs/backend-layering-actions-and-domain-memo-2026-04-16.md`**. The paths below are historical.

**Goal:** Move remaining **WSF `ws-dottie` fetch + map-to-Convex** pipelines out of `convex/functions/**/actions.ts` into **`convex/adapters/wsf/`**, matching the pattern already used for vessel locations and pings.

---

## Reference pattern (do this the same way)

Study these as the **canonical examples**:

| Concern | Location |
|--------|----------|
| Fetch + map in one module | [`convex/adapters/wsf/fetchVesselLocations.ts`](../../convex/adapters/wsf/fetchVesselLocations.ts), [`convex/adapters/wsf/fetchVesselPings.ts`](../../convex/adapters/wsf/fetchVesselPings.ts) |
| Public surface | [`convex/adapters/wsf/index.ts`](../../convex/adapters/wsf/index.ts) — **re-export** new adapters from here; call sites import `adapters/wsf` unless you have a strong reason not to |
| Convex storage types | `ConvexVesselLocation` stays in [`convex/functions/vesselLocation/schemas.ts`](../../convex/functions/vesselLocation/schemas.ts); **adapters** import those types and own WSF → row mapping |
| Thin actions | [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts) — load identities, call adapter, persist |

**Expectations for each new adapter file:**

1. **Call the relevant `ws-dottie` API** (or APIs) for the slice you own.
2. **Normalize / “resolve”** feed gaps where the codebase already does (e.g. merge known marine locations, filter rows missing required identity fields).
3. **Map to the Convex-backed type** defined in the matching **`schemas.ts`** (validator stays in `functions/`; adapter produces values that satisfy it).
4. Keep **`functions/*/actions.ts`** limited to **`ctx`**, orchestration, and **`runMutation` / `runQuery`** — not raw WSF shapes or long mapping chains.

Run **`bun run check:fix`**, **`bun run type-check`**, **`bun run convex:typecheck`**, and relevant **`bun test`** after changes.

---

## 1. Terminal identities — `fetchTerminalLocations`

**Source today:** [`convex/functions/terminalIdentities/actions.ts`](../../convex/functions/terminalIdentities/actions.ts) (`syncBackendTerminalTable`, helpers, `KNOWN_MARINE_LOCATIONS`, `mergeKnownMarineLocations`, etc.).

**Upstream:** `fetchTerminalLocations` from `ws-dottie/wsf-terminals/core` (`TerminalLocation`).

**Target Convex type:** [`TerminalIdentity`](../../convex/functions/terminalIdentities/schemas.ts) — see `terminalIdentitySchema` in [`convex/functions/terminalIdentities/schemas.ts`](../../convex/functions/terminalIdentities/schemas.ts).

**Suggested module name:** e.g. `convex/adapters/wsf/fetchTerminalIdentities.ts` (or `buildTerminalIdentitiesFromWsf.ts` if you prefer verb-first).

**Move / consolidate:**

- `hasTerminalIdentity`, `roundCoordinate`, row mapping into `TerminalIdentity` (including `UpdatedAt` stamping).
- `KNOWN_MARINE_LOCATIONS` + `mergeKnownMarineLocations` (feed gaps / missing marine facilities).
- Types like `TerminalLocationWithIdentity`, `ManualMarineLocation` if still needed privately.

**Action layer after extraction:** `syncBackendTerminalTable` should **await the adapter** to get `TerminalIdentity[]`, then **`runMutation(replaceBackendTerminals, …)`** only.

---

## 2. Vessel identities — `fetchVesselBasics`

**Source today:** [`convex/functions/vesselIdentities/actions.ts`](../../convex/functions/vesselIdentities/actions.ts) (`syncBackendVesselTable`, `hasVesselIdentity`, `toBackendVessel`).

**Upstream:** `fetchVesselBasics` from `ws-dottie/wsf-vessels/core` (`VesselBasic`).

**Target Convex type:** [`VesselIdentity`](../../convex/functions/vesselIdentities/schemas.ts) — `vesselIdentitySchema` in the same file.

**Suggested module name:** e.g. `convex/adapters/wsf/fetchVesselIdentities.ts`.

**Move / consolidate:**

- Filter + map from `VesselBasic` to `VesselIdentity` (trim name/abbrev, required-field guard).

**Action layer after extraction:** `syncBackendVesselTable` calls adapter → `replaceBackendVessels`.

---

## 3. Terminals topology — `fetchTerminalsAndMates` + `fetchRoutesByTripDateAndTerminals`

**Source today:** [`convex/functions/terminalsTopology/actions.ts`](../../convex/functions/terminalsTopology/actions.ts) — especially `buildBackendTerminalsTopologyRows` and its use of:

- `fetchTerminalsAndMates` (`ws-dottie/wsf-schedule/core`)
- `fetchRoutesByTripDateAndTerminals` (same package, `Route` type)
- Then pure assembly via `buildTerminalTopologyRows`, `normalizeRouteAbbrevs`, `normalizeRouteAbbrev`, `toTerminalPairKey`, `mergeSortedStrings`, etc.

**Target Convex type:** [`TerminalTopology`](../../convex/functions/terminalsTopology/schemas.ts) — `terminalTopologySchema`.

**Suggested module name:** e.g. `convex/adapters/wsf/fetchTerminalsTopology.ts` (single file is fine if it stays readable; split fetch vs pure graph build only if length forces it).

**Design notes:**

- Callers already have **`TerminalIdentity[]`** (passenger subset + ID lookups). The adapter should accept **canonical terminals + sailing day** (or `Date`) and perform the **schedule API** calls + **mapping to `TerminalTopology[]`**, reusing or moving the existing helpers currently next to `buildBackendTerminalsTopologyRows`.
- **“Resolve missing data”** here means: join combo rows to backend terminals by ID, skip incomplete pairs (current behavior), normalize route abbreviations into the app slug set.
- `getSailingDay` from [`shared/time`](../../convex/shared/time.ts) is appropriate to keep as a shared primitive; the adapter may take `tripDate: string` as an argument to ease testing.

**Action layer after extraction:** `refreshBackendTerminalsTopologyImpl` should call **one adapter** (or a small facade) that returns `TerminalTopology[]`, then **`replaceBackendTerminalsTopology`**.

---

## Cross-cutting reminders

- **No duplicate `TerminalIdentity` definitions** — use [`functions/terminalIdentities/schemas`](../../convex/functions/terminalIdentities/schemas.ts) (see prior `resolveTerminal` cleanup).
- **Resolvers:** If you need strict vs optional vessel/terminal lookup, follow [`convex/adapters/wsf/resolveVessel.ts`](../../convex/adapters/wsf/resolveVessel.ts) (`resolveVessel` vs `tryResolveVessel`).
- **Barrel file:** Add exports to [`convex/adapters/wsf/index.ts`](../../convex/adapters/wsf/index.ts) so **`import { … } from "adapters/wsf"`** remains the default for Convex code.

---

## Suggested completion order

1. **Vessel identities** — smallest surface (`fetchVesselBasics` → `VesselIdentity[]`).
2. **Terminal identities** — more helpers (marine merge, coordinates).
3. **Topology** — most moving parts (two fetchers + graph assembly).

Ship in one PR or three; keep CI green after each slice.
