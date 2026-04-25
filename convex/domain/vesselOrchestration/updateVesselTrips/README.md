# updateVesselTrips

`updateVesselTrips` owns one narrow concern:

> Given one orchestrator ping, produce the authoritative active and completed
> `ConvexVesselTrip` rows for that ping.

## Public surface

Root exports are intentionally small:

- `computeVesselTripsRows(input) -> { activeTrips, completedTrips }`
- `computeVesselTripUpdate(input) -> VesselTripUpdate`
- `RunUpdateVesselTripsOutput`
- `VesselTripUpdate`

The production orchestrator hot path uses `computeVesselTripUpdate` in a
per-vessel loop over the **full** normalized location batch each ping so one
failed vessel can be isolated without stopping the fleet ping.
`computeVesselTripsRows` remains the rows-only domain runner for callers that
only need merged active/completed rows.

## What this folder owns

- Feed-driven lifecycle detection for one vessel ping
- Building storage-shaped active and completed trip rows
- Schedule-backed trip-field enrichment through `tripFields/`
- Per-vessel change classification:
  - `tripStorageChanged`
  - `tripLifecycleChanged`
- Batch merging of changed actives with unchanged carry-forward actives

It does not own location persistence, ML prediction attachment, or timeline
storage.

## One-vessel flow

For one vessel, the pipeline is intentionally linear:

```text
computeVesselTripUpdate
  -> detectTripEvents
  -> buildTripRowsForPing
  -> classify storage change
  -> classify lifecycle change
```

`buildTripRowsForPing` is the single row-construction seam. Its internal order
is:

1. Resolve schedule-facing trip fields through `tripFields/`
2. Build the base active or replacement row
3. Finalize arrival/completion fields
4. Clear stale next-leg attachment when identity changed
5. Return the completed row and/or the active row for this ping

## Module map

- `computeVesselTripUpdate.ts`
  - One-vessel orchestration and change classification
- `computeVesselTripsRows.ts`
  - Canonical rows-only batch runner
- `lifecycle.ts`
  - Feed-driven lifecycle facts for one ping
- `tripBuilders.ts`
  - Single exported row-construction seam: `buildTripRowsForPing`
- `tripFields/`
  - Schedule inference policy and next-leg attachment
- `storage.ts`
  - Pipeline-local failure logging

## Contracts

Durable trip output:

- `activeTrips: ReadonlyArray<ConvexVesselTrip>`
- `completedTrips: ReadonlyArray<ConvexVesselTrip>`

Orchestrator change bundle:

- `VesselTripUpdate`
  - processed `vesselLocation`
  - prior `existingActiveTrip`
  - next `activeTripCandidate`
  - optional `completedTrip`
  - optional `replacementTrip`
  - storage/lifecycle change flags

Shared cross-module contracts such as trip lifecycle event flags and storage
equality live in `domain/vesselOrchestration/shared`, not in this folder.
