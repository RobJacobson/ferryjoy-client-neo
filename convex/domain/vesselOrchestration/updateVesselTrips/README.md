# updateVesselTrips

Engineering memo for the current trip-update pipeline.

This folder owns one narrow concern:

> Given one orchestrator ping, determine the authoritative active and completed
> vessel-trip rows for that ping.

In code, the public batch contract is:

- `computeVesselTripsBatch(input) -> { updates, rows }`
- `computeVesselTripsRows(input) -> { activeTrips, completedTrips }`

The first shape exists for the orchestrator, which needs per-vessel change
metadata. The second is the smaller public runner for callers that only care
about trip rows.

## Scope

### This folder owns

- Per-ping physical lifecycle detection from raw feed rows
- Building active and completed `ConvexVesselTrip` rows
- Schedule-backed trip-field enrichment through `tripFields/`
- Per-vessel change classification (`tripStorageChanged`,
  `tripLifecycleChanged`)
- Batch merging of processed active trips with unchanged carry-forward actives

### This folder does not own

- Live location normalization or persistence
- Prediction attachment
- Timeline persistence
- Function-layer trip persistence plans

Those concerns live in sibling modules such as
`updateVesselLocations/`, `updateVesselPredictions/`, and
`functions/vesselOrchestrator/`.

## The Real-World Problem

The WSF vessel feed does not hand us durable trip rows. It gives us a stream of
location pings with partial physical state and sometimes-incomplete schedule
state.

This folder exists to answer three questions safely:

1. Did the vessel continue the same trip, complete a trip, or start a
   replacement trip?
2. What should the stored trip row look like after this ping?
3. Which vessels actually changed in a way that downstream stages should care
   about?

The tricky part is that physical lifecycle boundaries and schedule-backed trip
identity are related, but not the same thing. This code keeps those concerns
separate enough to reason about them, while still assembling one canonical row
shape.

## The Contract

### Durable contract

The durable output from this folder is:

- `activeTrips: ReadonlyArray<ConvexVesselTrip>`
- `completedTrips: ReadonlyArray<ConvexVesselTrip>`

Those rows are storage-shaped and prediction-free.

### Orchestrator contract

The orchestrator-facing batch helper also returns:

- `updates: ReadonlyArray<VesselTripUpdates>`

Each `VesselTripUpdates` entry carries:

- the vessel location processed for that ping
- the prior active trip, if any
- the next active candidate, if any
- the completed trip, if any
- the replacement trip, if one was created
- storage/lifecycle change flags

### Transient contract

This folder intentionally consumes but does not persist transient metadata such
as:

- trip-field inference logging from `tripFields/`
- one-ping physical lifecycle facts used only during row construction

That metadata is useful for observability and decision-making, but it is not
part of the stored trip meaning.

## Top-Down Pipeline

The top-level happy path is:

```text
raw vessel locations for one ping
  -> computeVesselTripsBatch
  -> computeVesselTripUpdate (one vessel)
  -> detectTripEvents
  -> buildTripRowsForPing
  -> merge authoritative active set
```

### Happy-path execution map

```text
                         ENTRY
                           |
                           v
                 raw vessel-location ping
                           |
                           v
              computeVesselTripUpdate(...)
                           |
                           v
                 detectTripEvents(...)
                           |
                           v
                 buildTripRowsForPing(...)
                           |
               +-----------+------------+
               |                        |
               | continuing ping        | completion ping
               v                        v
            buildTripCore         buildCompletedTrip
               |                        |
               |                        v
               |               build replacement active
               |                        |
               +-----------+------------+
                           |
                           v
                per-vessel trip outcome
                           |
                           v
                computeVesselTripsBatch(...)
                           |
                           v
          merge processed actives with untouched carry-forward actives
                           |
                           v
                { activeTrips, completedTrips }
                           |
                          EXIT
```

## Module Map

### `computeVesselTripsBatch.ts`

Canonical batch runner.

Responsibilities:

- Narrow one schedule snapshot into schedule tables
- Join each processed vessel location to its prior active trip
- Run `computeVesselTripUpdate` per vessel
- Merge processed actives with untouched carry-forward actives
- Return both per-vessel updates and trip rows

This is the main place where the batch contract stays DRY across the domain
runner and the orchestrator.

### `computeVesselTripUpdate.ts`

One-vessel runner.

Responsibilities:

- Detect lifecycle events for one ping
- Build optional completed and/or active rows
- Classify whether storage changed
- Classify whether lifecycle changed

This file is intentionally small. It is the seam between batch assembly and the
row-building logic.

### `lifecycle.ts`

Physical lifecycle detection.

Responsibilities:

- Dock/sea debounce from raw feed signals
- Leave-dock / arrive-dock detection
- Raw schedule-key transition detection used for lifecycle purposes
- Computing the event bundle consumed by trip builders

This module owns only feed-driven lifecycle facts. It does not infer schedule
fields or build storage rows.

### `tripBuilders.ts`

Trip row construction.

Responsibilities:

- Build continuing active trip rows
- Build replacement trip rows after completion
- Build completed trip rows
- Merge resolved current-trip fields from `tripFields/`
- Clear stale derived schedule state when a trip changes attachment
- Attach next-leg schedule fields

This file intentionally groups tightly-coupled builder helpers together so the
reader can understand one trip row build without jumping across several tiny
files.

### `storage.ts`

Small support helpers.

Responsibilities:

- Compare storage-shaped trip rows
- Log per-vessel trip pipeline failures

These helpers are intentionally colocated because they support the pipeline but
do not define its core behavior.

### `tripFields/`

See [`tripFields/README.md`](./tripFields/README.md).

That folder remains the dedicated owner of trip-field inference policy. This
folder consumes its resolved current-trip fields but does not re-implement that
policy.

## Decision Order

The high-level decision order for one vessel ping is:

1. Detect physical lifecycle facts from raw feed state
2. Decide whether the ping completes a prior trip
3. If completing, build the completed row first
4. Build the next active row using resolved current-trip fields
5. Compare the resulting active row to storage
6. Merge the processed result back into the batch’s authoritative active set

That gives the folder one clear precedence rule:

| Priority | Concern | Meaning |
| --- | --- | --- |
| 1 | Physical lifecycle | Decide whether the trip continues or completes |
| 2 | Current-trip field resolution | Decide which schedule-facing identity to attach |
| 3 | Row building | Materialize completed and/or active rows |
| 4 | Storage comparison | Decide whether downstream work should continue |

## Per-Vessel Branch Map

Almost every interesting case is a variation on this tree:

```text
computeVesselTripUpdate(location, existingActiveTrip, scheduleTables)
|
+-- detectTripEvents(...)
|   |
|   +-- isCompletedTrip && existingActiveTrip exists?
|   |   |
|   |   +-- yes --> buildCompletedTrip
|   |   |           -> build replacement active via buildTripCore
|   |   |
|   |   +-- no
|   |       |
|   |       +-- isCompletedTrip with no prior active?
|   |       |   |
|   |       |   +-- yes --> emit no rows
|   |       |   +-- no  --> build continuing active via buildTripCore
|   |
|   +-- compare active candidate with existing trip for storage change
|
+-- package VesselTripUpdates
```

## Batch Merge Rules

`computeVesselTripsBatch` applies one important merge rule:

- vessels processed this ping replace their prior active row
- vessels absent from the processed set keep their prior active row unchanged

That means `activeTrips` is always the authoritative active set after the ping,
not merely the subset touched by the feed batch.

## Relationship To `tripFields/`

The seam between the two folders is:

1. `tripBuilders.ts` asks `tripFields/resolveCurrentTripFields(...)` for the
   current schedule-facing trip identity
2. `tripBuilders.ts` builds the base trip row from:
   - raw vessel location
   - prior trip state
   - lifecycle events
   - resolved trip fields
3. `tripBuilders.ts` calls `attachNextScheduledTripFields(...)` after the base
   row exists

Interpretation:

- `tripFields/` decides what the current scheduled identity should be
- `updateVesselTrips/` decides what happened physically and what row to store

## Failure Policy

This folder is intentionally defensive around per-vessel failures.

- If a continuing update fails, the prior active trip is reused when one exists
- If a completion update fails after a prior active exists, the prior active
  row is preserved so the vessel does not disappear from the active set
- Failures are logged per vessel through `storage.ts`

This keeps one bad ping from dropping trip tracking for the vessel entirely.

## Why The Folder Looks Like This

The current organization is intentionally by concern, not by microscopic helper:

- `lifecycle.ts` answers: what happened?
- `tripBuilders.ts` answers: what rows do we build?
- `computeVesselTripUpdate.ts` answers: what changed for one vessel?
- `computeVesselTripsBatch.ts` answers: what changed for the whole ping?

That split keeps the main concepts visible without forcing tightly-coupled
helpers into one-file-per-function abstractions.

## Recommended Reading Order

If you are new to this code, read in this order:

1. [`computeVesselTripsBatch.ts`](./computeVesselTripsBatch.ts)
2. [`computeVesselTripUpdate.ts`](./computeVesselTripUpdate.ts)
3. [`lifecycle.ts`](./lifecycle.ts)
4. [`tripBuilders.ts`](./tripBuilders.ts)
5. [`tripFields/README.md`](./tripFields/README.md)

That sequence goes from public batch contract to one-vessel logic to the lower
level builder details.
