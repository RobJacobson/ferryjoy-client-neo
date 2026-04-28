# updateVesselTrip

`updateVesselTrip` owns one narrow concern:

> Given one vessel location ping, produce the authoritative active and
> completed `ConvexVesselTrip` rows for that vessel update.

## Public surface

Root exports are intentionally small:

- `updateVesselTrip(input) -> VesselTripUpdate | null` (null when no substantive durable change; errors are caught and return null)
- `isUpdatedVesselTrip(existingActiveTrip, activeTripCandidate) -> boolean`
- `VesselTripUpdate`

The production orchestrator hot path calls `updateVesselTrip` inside its
per-vessel loop so one failed vessel can be isolated without stopping the
fleet ping.

## What this folder owns

- Feed-driven lifecycle detection for one vessel ping
- Building storage-shaped active and completed trip rows
- Schedule-backed trip-field enrichment through `tripFields/`
- Per-vessel meaningful-change classification
- Batch merging of changed actives with unchanged carry-forward actives

It does not own location persistence, ML prediction attachment, or timeline
storage.

## One-vessel flow

For one vessel, the pipeline is intentionally linear:

```text
updateVesselTrip
  -> detectTripEvents
  -> buildUpdatedVesselRows
     -> basicTripRows
     -> scheduleEnrichment
  -> isUpdatedVesselTrip
```

`buildUpdatedVesselRows` is the single row-construction seam. Its internal order
is:

1. Build the completed row, if the ping completed a trip
2. Build the basic active or replacement row from lifecycle state
3. Resolve schedule-facing trip fields through `tripFields/`
4. Apply current and next schedule fields to the active row
5. Return the completed row and/or the active row for this ping

## Module map

- `updateVesselTrip.ts`
  - One-vessel orchestration and meaningful-change classification
- `lifecycle.ts`
  - Feed-driven lifecycle facts for one ping
- `tripBuilders.ts`
  - Single exported row-construction seam: `buildUpdatedVesselRows`
- `basicTripRows.ts`
  - Schedule-free completed and active row construction
- `scheduleEnrichment.ts`
  - Current and next schedule-field application for active rows
- `tripEvidence.ts`
  - Shared trip-evidence checks used by lifecycle and row construction
- `tripFields/`
  - Schedule inference policy and next-leg attachment
- `storage.ts`
  - Pipeline-local failure logging

## Contracts

Physical phase contract:

- Trip-row `AtDock` is persisted from location `AtDockObserved` (stabilized
  dock/sea phase), not directly from raw feed `AtDock`.

Orchestrator change bundle:

- `VesselTripUpdate` (see `types.ts`)
  - `vesselAbbrev`
  - `existingActiveTrip?` — prior row for this vessel (debug + downstream derivation)
  - `activeVesselTripUpdate?` — active row to upsert when it changed substantively
  - `completedVesselTripUpdate?` — completed row when a leg finished this ping

Shared cross-module contracts such as trip lifecycle event flags and storage
equality live in `domain/vesselOrchestration/shared`, not in this folder.
