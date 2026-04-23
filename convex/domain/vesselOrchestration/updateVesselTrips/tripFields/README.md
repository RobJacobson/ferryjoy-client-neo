# tripFields

Engineering memo for the current trip-field inference code.

This folder owns one narrow concern:

> Given one vessel-location ping, determine the scheduled-trip fields we should
> use for trip construction when WSF is incomplete.

In code, the narrowed output is `ResolvedCurrentTripFields` (see `types.ts`). In
prose, provisional schedule-backed values fill the gap until WSF provides
authoritative data.

## Scope

### This folder owns

- Determining whether WSF is authoritative for the current ping
- Inferring provisional trip fields from schedule evidence when WSF is incomplete
- Reusing already-known provisional fields when that is safer than claiming a
  new schedule match
- Attaching next-leg schedule fields after the base trip row is built
- Emitting low-noise observability about meaningful inference transitions

### This folder does not own

- Physical arrival/departure detection
- Dock/sea debounce policy
- Trip lifecycle boundaries
- Prediction attachment
- Persistence policy

Those concerns live in sibling modules such as
[`tripLifecycle/`](../tripLifecycle/) and the orchestrator functions.

## The Real-World Problem

The WSF vessel feed often omits two fields that matter for user-facing trip
state:

- `ArrivingTerminalAbbrev`
- `ScheduledDeparture`

Without those two fields, we cannot claim an authoritative scheduled-trip
identity from the feed. However, in normal service we often have enough
schedule evidence to make an informed, provisional guess.

This code exists to avoid presenting an obviously incomplete state like
"unknown destination" when the likely scheduled leg is clear from the current
schedule context.

## The Contract

### Durable contract

The durable semantic contract is:

- resolved current-trip fields:
  - `ArrivingTerminalAbbrev`
  - `ScheduledDeparture`
  - `ScheduleKey`
  - `SailingDay`
- `tripFieldDataSource: "wsf" | "inferred"`

Interpretation:

- `wsf`
  WSF provided authoritative destination + scheduled departure for this ping.
  `ScheduleKey` may still be derived locally from those direct WSF fields.
- `inferred`
  The row is using provisional schedule-backed fields because WSF is incomplete.

### Transient contract

The following metadata is intentionally transient:

- `tripFieldInferenceMethod: "next_scheduled_trip" | "schedule_rollover"`

This explains how inference happened for the current ping. It is useful for
observability, but it is not part of the persisted meaning of a trip row and is
therefore excluded from `ConvexVesselTrip`.

## Top-Down Pipeline

The happy-path pipeline for this folder is:

```text
raw location ping
  -> hasWsfTripFields
  -> resolveCurrentTripFields
  -> base trip build merges raw location + resolution (tripLifecycle/)
  -> attachNextScheduledTripFields
```

### Happy-path execution map

This is the major entry-to-exit flow when things go well and we can attach a
coherent scheduled identity to the row:

```text
                         ENTRY
                           |
                           v
                raw vessel location ping
                           |
                           v
              resolveCurrentTripFields(...)
                           |
             +-------------+-------------+
             |                           |
             | WSF authoritative         | WSF incomplete
             v                           v
      getTripFieldsFromWsf        schedule evidence lookup
             |                           |
             |                           +-----------------------------+
             |                           |                             |
             |                           | next key hit                | rollover hit
             |                           v                             v
             |                getNextScheduledTrip...        getRolledOverScheduledTrip
             |                           |                             |
             +-------------+-------------+-------------+---------------+
                                           |
                                           v
                            ResolvedCurrentTripFields
                                           |
                                           v
                     tripLifecycle/baseTripFromLocation(...)
                                           |
                                           v
                       attachNextScheduledTripFields(...)
                                           |
                                           v
                                  ConvexVesselTrip row
                                           |
                                          EXIT
```

### Happy path: WSF is authoritative

This is the simplest and preferred case.

1. [`hasWsfTripFields.ts`](./hasWsfTripFields.ts) checks whether WSF supplied:
   - `ArrivingTerminalAbbrev`
   - `ScheduledDeparture`
2. If both are present, [`getTripFieldsFromWsf.ts`](./getTripFieldsFromWsf.ts)
   returns:
   - those direct fields
   - `tripFieldDataSource: "wsf"`
   - a locally derived `ScheduleKey` when WSF omitted that key but the direct
     fields are sufficient to derive it safely
3. `tripLifecycle/buildTripCore` passes the raw location plus
   `ResolvedCurrentTripFields` into `baseTripFromLocation` (no location overlay)
4. [`attachNextScheduledTripFields.ts`](./attachNextScheduledTripFields.ts)
   adds `NextScheduleKey` / `NextScheduledDeparture` when the schedule evidence
   supports them

### Happy path: WSF is incomplete, but schedule evidence is clear

This is the main inference case.

1. `hasWsfTripFields(...)` returns `false`
2. [`resolveCurrentTripFields.ts`](./resolveCurrentTripFields.ts) tries schedule
   evidence in order:
   - [`getNextScheduledTripFromExistingTrip.ts`](./getNextScheduledTripFromExistingTrip.ts)
   - else [`getRolledOverScheduledTrip.ts`](./getRolledOverScheduledTrip.ts)
3. A hit maps the segment to current-trip resolution (`ArrivingTerminalAbbrev`,
   `ScheduledDeparture`, `ScheduleKey`, optional `SailingDay`,
   `tripFieldDataSource: "inferred"`, `tripFieldInferenceMethod`)
4. `tripLifecycle` merges that resolution with the raw location inside
   `deriveTripInputs` / `baseTripFromLocation` (next-leg fields are **not** part
   of this contract; see `attachNextScheduledTripFields`)

## Decision Order

[`resolveCurrentTripFields.ts`](./resolveCurrentTripFields.ts) is the canonical
entrypoint. Its policy is intentionally short:

1. If WSF has both direct fields, use WSF
2. Otherwise try `NextScheduleKey` from the existing trip
3. Otherwise try schedule rollover from the prior scheduled departure
4. Otherwise fall back to safe reuse / partial WSF preservation

That means this folder has one clear precedence rule:

| Priority | Source | Meaning |
| --- | --- | --- |
| 1 | WSF direct fields | Authoritative current-trip fields |
| 2 | Existing trip `NextScheduleKey` | Expected next scheduled leg is known |
| 3 | Schedule rollover | Next scheduled departure can be inferred from time + terminal |
| 4 | Safe fallback | Preserve stable provisional fields or partial WSF values without claiming a new match |

### Branch map

The main branching logic is intentionally narrow. Almost every interesting case
is a variation on this tree:

```text
resolveCurrentTripFields(location, existingTrip, scheduleTables)
|
+-- hasWsfTripFields(location)?
|   |
|   +-- yes --> getTripFieldsFromWsf --> resolved as `tripFieldDataSource: "wsf"`
|   |
|   +-- no
|       |
|       +-- existingTrip.NextScheduleKey resolves and terminal matches?
|       |   |
|       |   +-- yes --> infer from scheduled segment
|       |   |           `tripFieldInferenceMethod: "next_scheduled_trip"`
|       |   |
|       |   +-- no
|       |       |
|       |       +-- later same-terminal departure found by rollover lookup?
|       |           |
|       |           +-- yes --> infer from scheduled segment
|       |           |           `tripFieldInferenceMethod: "schedule_rollover"`
|       |           |
|       |           +-- no --> getFallbackTripFields
|       |                       preserve partial WSF and/or reuse stable trip fields
|       |
|       +-- all non-WSF outcomes are still `tripFieldDataSource: "inferred"`
|
+-- baseTripFromLocation merges raw feed + resolved current-trip fields
|
+-- attachNextScheduledTripFields
    |
    +-- no `ScheduleKey` --> leave next-leg fields empty
    +-- same `ScheduleKey` --> preserve existing next-leg fields
    +-- new `ScheduleKey` with known segment --> attach `NextKey` / `NextDepartingTime`
    +-- new `ScheduleKey` with missing segment --> clear stale next-leg fields
```

## Schedule Evidence Paths

### Path 1: next scheduled trip

[`getNextScheduledTripFromExistingTrip.ts`](./getNextScheduledTripFromExistingTrip.ts)
is the cleanest inference path.

Use it when:

- the existing trip already carries `NextScheduleKey`
- that key resolves to a known scheduled segment
- the segment departs from the vessel's current departing terminal

If all of those are true, we infer trip fields from that scheduled segment and
mark:

- `tripFieldDataSource: "inferred"`
- `tripFieldInferenceMethod: "next_scheduled_trip"`

### Path 2: schedule rollover

[`getRolledOverScheduledTrip.ts`](./getRolledOverScheduledTrip.ts) is the backup
path when there is no trustworthy `NextScheduleKey`.

Use it when:

- the existing trip has a prior `ScheduledDeparture`
- the prior trip's sailing day or the current schedule snapshot day contains a
  later departure for the same vessel
- that later departure matches the vessel's current departing terminal

This is how the code says, in effect:

> We do not know the next leg directly, but based on the vessel's last scheduled
> departure and the current schedule snapshot, this appears to be the next
> scheduled segment.

That path marks:

- `tripFieldDataSource: "inferred"`
- `tripFieldInferenceMethod: "schedule_rollover"`

## Fallback Behavior

[`getFallbackTripFields.ts`](./getFallbackTripFields.ts) handles the cases where
WSF is incomplete and no schedule match can be claimed safely.

This function does two important things:

1. Preserve any direct WSF values that do exist
2. Reuse already-known provisional fields only in a narrow same-dock-window case

Implementation note:

- the helper computes a single `reusedTrip` alias after the reuse check so the
  fallback field selection stays linear and easy to audit

The reuse case is intentionally conservative. It requires:

- current location says `AtDock`
- current location has not yet set `LeftDock`
- existing trip is also still docked
- existing trip has not yet set `LeftDock`
- both rows agree on `DepartingTerminalAbbrev`

When that is true, we keep the already-known provisional fields stable instead
of pretending we found a fresh schedule match.

This is why the returned semantic source may still be:

- `tripFieldDataSource: "inferred"`

even though the values were copied from the existing trip row. The semantic
question is whether the fields are still provisional, not where the bytes came
from.

## Resolution seam to `tripLifecycle/`

`ResolvedCurrentTripFields` stops at current-trip schedule identity. The raw
`ConvexVesselLocation` is unchanged; `tripLifecycle/baseTripFromLocation` calls
`deriveTripInputs`, which prefers resolved values when present and otherwise
falls back to the feed. That replaces the old “overlay onto a prepared location,
then re-derive identity” staging step.

## Next-Leg Enrichment

[`attachNextScheduledTripFields.ts`](./attachNextScheduledTripFields.ts) runs
after the base trip row has been built.

Its job is separate from current-trip inference:

- current-trip inference determines the scheduled fields for *this* row
- next-leg enrichment determines the optional schedule hints for the *following*
  row

Behavior:

- if the built row has no `ScheduleKey`, do nothing
- if the `ScheduleKey` is unchanged from the existing trip, preserve existing
  next-leg fields when the current row has not already provided them
- if the `ScheduleKey` changed and the new segment is present in the snapshot,
  attach its `NextKey` / `NextDepartingTime`
- if the `ScheduleKey` changed and the new segment is missing, clear carried
  next-leg fields instead of keeping stale hints from the previous segment

## Observability

This folder includes
[`logTripFieldInference.ts`](./logTripFieldInference.ts), but logging is wired
at the trip-row seam rather than inside the pure inference helpers.

That is deliberate:

- inference helpers stay pure
- low-noise policy stays centralized
- transient metadata does not need to leak into stored trip rows

What is worth logging:

- provisional trip fields start from schedule evidence
- provisional trip fields change to a different resolved value
- partial WSF values conflict with the inferred result
- authoritative WSF fields replace prior values

What is intentionally silent:

- unchanged reuse of already-stable provisional fields
- unchanged authoritative WSF fields
- `ScheduleKey` backfill alone when WSF is already authoritative
- initial authoritative WSF rows with no prior trip fields

## Edge Cases

### Edge-case branch summary

These are the major "why did we go down that path?" cases:

```text
WSF complete?
|
+-- yes --> authoritative WSF path
|
+-- no
    |
    +-- next scheduled segment is trustworthy?
    |   |
    |   +-- yes --> inferred from `NextScheduleKey`
    |   +-- no
    |
    +-- rollover lookup finds a later departure?
    |   |
    |   +-- yes --> inferred from schedule rollover
    |   +-- no
    |
    +-- same dock window and existing provisional trip is stable?
    |   |
    |   +-- yes --> reuse existing provisional fields
    |   +-- no
    |
    +-- partial WSF fields exist?
        |
        +-- yes --> preserve what WSF gave us, but still mark as inferred
        +-- no --> return the safest sparse inferred result we can
```

### WSF omits destination/departure at trip start

This is the normal motivating case.

Handling:

- infer provisional trip fields from schedule evidence
- keep them stable until WSF becomes authoritative

### WSF omits destination/departure after departure

This can happen in both normal service and genuinely unusual operations.

Handling:

- do not treat the omission itself as an error
- continue using provisional trip fields when we still have a safe basis to do so
- replace them immediately when WSF later provides authoritative values

### Vessel goes out of service unexpectedly

The schedule inference can become wrong because the real-world vessel behavior
breaks from the schedule.

Handling:

- inference remains provisional, not permanent truth
- physical lifecycle still comes from the raw feed, not from schedule inference
- when schedule attachment is lost or a physical replacement trip begins,
  downstream trip build logic clears schedule-derived next-leg state as needed

### Feed flicker at dock/sea boundaries

This folder does not solve dock/sea debounce problems.

Handling:

- `tripFields/` consumes the current ping plus existing trip state
- physical lifecycle acceptance/rejection remains the responsibility of
  `tripLifecycle/`

### Partial WSF values

WSF may provide one field but not the other, such as destination without a
scheduled departure.

Handling:

- partial WSF data is preserved where safe
- but partial WSF alone is not treated as authoritative
- if the resolved provisional result conflicts with the partial WSF fields, that
  may be logged at info level for diagnostics

## File Map

| File | Role |
| --- | --- |
| [`resolveCurrentTripFields.ts`](./resolveCurrentTripFields.ts) | Canonical policy entrypoint (WSF → next key → rollover → fallback) |
| [`hasWsfTripFields.ts`](./hasWsfTripFields.ts) | Decide whether WSF is authoritative |
| [`getTripFieldsFromWsf.ts`](./getTripFieldsFromWsf.ts) | Normalize the WSF path into the common return shape |
| [`getNextScheduledTripFromExistingTrip.ts`](./getNextScheduledTripFromExistingTrip.ts) | Inference from `NextScheduleKey` |
| [`getRolledOverScheduledTrip.ts`](./getRolledOverScheduledTrip.ts) | Inference from schedule rollover |
| [`getFallbackTripFields.ts`](./getFallbackTripFields.ts) | Preserve partial WSF values and safely reuse stable provisional fields |
| [`attachNextScheduledTripFields.ts`](./attachNextScheduledTripFields.ts) | Attach next-leg schedule hints after trip build |
| [`logTripFieldInference.ts`](./logTripFieldInference.ts) | Low-noise observability policy |
| [`types.ts`](./types.ts) | Durable vs transient metadata contract |

## Reading Guide

If you are new to this code, read in this order:

1. [`types.ts`](./types.ts)
2. [`resolveCurrentTripFields.ts`](./resolveCurrentTripFields.ts)
3. [`getNextScheduledTripFromExistingTrip.ts`](./getNextScheduledTripFromExistingTrip.ts) / [`getRolledOverScheduledTrip.ts`](./getRolledOverScheduledTrip.ts)
4. [`getFallbackTripFields.ts`](./getFallbackTripFields.ts)
5. [`attachNextScheduledTripFields.ts`](./attachNextScheduledTripFields.ts)
6. [`logTripFieldInference.ts`](./logTripFieldInference.ts)

Then jump to [`tripLifecycle/buildTrip.ts`](../tripLifecycle/buildTrip.ts) to see
how raw locations plus `ResolvedCurrentTripFields` flow into the wider trip-update
pipeline.
