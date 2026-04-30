# `buildActiveTrip` cleanup proposals

## Context

Current implementation has clear behavior but still carries branching shape from the old three-function style:

- cold start (first trip, rare)
- new trip rollover (uncommon)
- continuing trip update (normal)

Goal: keep all three scenario semantics together, reduce spread/duplication, and make field policy obvious for future schema simplification.

## Design constraints

- Preserve existing behavior for `new trip` and `continuing`.
- Keep cold-start behavior explicit (accepted uncertainty).
- Keep `LeftDockActual` for now.
- Prefer one main function with helper overlays if readability holds.
- Make per-field policy discoverable in one place.

## Proposal A (recommended): One base builder + mode overlays

### Shape

- Keep one exported orchestrator: `buildActiveTrip(...)`.
- Add enum: `TripBuildMode = "coldStart" | "rollover" | "continuing"`.
- Build `mode` once from `isNewTrip` and `previousTrip`.
- Build a common `base` object from `prev` + `loc` + derived helpers.
- Apply one mode overlay:
  - `applyRolloverOverlay(base, ctx)`
  - `applyContinuingOverlay(base, ctx)`
  - cold start can be identity (or tiny overlay).

Pattern:

```ts
const base = buildBaseTrip(ctx);
const modePatch =
  mode === "rollover"
    ? rolloverPatch(ctx)
    : mode === "continuing"
      ? continuingPatch(ctx)
      : coldStartPatch(ctx);

return { ...base, ...modePatch };
```

### Why it fits your goal

- One main function.
- One canonical place for shared semantics (`buildBaseTrip`).
- Edge-case differences isolated to short patches.
- Easy to reason about "same unless mode says otherwise".

### Trade-offs

- Requires discipline so `buildBaseTrip` does not become too clever.
- Debugging can involve checking both base and overlay layers.

## Proposal B: Field policy map (declarative)

### Shape

- Define mode enum.
- For each field, define one resolver function:
  - `resolveTripKey(ctx, mode)`
  - `resolveLeftDock(ctx, mode)`
  - etc.
- Main function assembles object by calling all resolvers.

### Pros

- Maximum locality per field (all 3 modes visible together).
- Very explicit for audits and schema migrations.

### Cons

- Verbose boilerplate with many small functions.
- Harder to scan lifecycle as a coherent flow.
- Easy to over-engineer (exact concern you raised).

## Proposal C: Keep 3 builders + shared primitives

### Shape

- Keep `buildColdStart`, `buildRollover`, `buildContinuing`.
- Extract common helpers:
  - identity derivation
  - left-dock continuity
  - schedule continuity
  - base write helpers

### Pros

- Lowest risk to current structure.
- Very straightforward to debug path-by-path.

### Cons

- Still spreads logic across functions.
- "Same field, different place" problem remains.

## Recommendation

Choose **Proposal A**.

It best balances your goals:

- centralizes shared/default semantics
- keeps scenario diffs explicit and small
- avoids policy-map over-abstraction
- keeps implementation readable to future maintainers

## Recommended implementation sketch

1. Add `TripBuildMode` and compute it once.
2. Create `buildBaseTrip(ctx)` with "shared/default" values.
   - Prefer `prev` when that is true for both continuing and rollover continuity fields.
   - Use `loc` for live feed-owned fields.
3. Add `rolloverPatch(ctx)` for true rollover-only resets/stamps:
   - reset departure-tied fields
   - carry prior-leg pointers (`Prev*`, `Next*`)
   - set rollover `TripStart`
4. Add `continuingPatch(ctx)` for ongoing-trip continuity:
   - resolved terminal/schedule
   - left-dock transitions
   - durations/delay recompute
5. Keep cold-start as base-only (or minimal patch).
6. Add targeted tests around:
   - mode selection
   - fields intentionally diverging by mode
   - unchanged "same" fields across all modes

## Guardrails to avoid regressions

- Introduce a test matrix keyed by mode and high-risk fields:
  - `TripKey`, `TripStart`, `LeftDock`, `LeftDockActual`, `TripDelay`,
    `ScheduledDeparture`, `PrevScheduledDeparture`, `PrevLeftDock`.
- Assert semantic invariants (not just snapshots), e.g.:
  - rollover: `LeftDock` and `LeftDockActual` reset
  - continuing: `ScheduledDeparture` follows resolved value
  - cold-start at-sea: `LeftDockActual` can initialize from `loc.LeftDock`

## Practical next step

Implement Proposal A in a single refactor PR that is behavior-preserving relative to current code, then do schema-field deletions in a follow-up PR. This keeps review scope clean: first structure, then semantics.
