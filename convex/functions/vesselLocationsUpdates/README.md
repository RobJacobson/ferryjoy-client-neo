# vesselLocationsUpdates

This concern exists to support a very specific cost/performance optimization in the vessel orchestrator.

## Why this table exists

`vesselLocations` stores the full live vessel location payload (many fields per row).  
The orchestrator pings every 5 seconds. In practice, upstream WSF data often does **not** change between pings.

Originally, dedupe logic still required scanning full `vesselLocations` rows during writes. That defeated the intent of dedupe from a Convex Database I/O perspective, because full-document reads are heavier than needed.

`vesselLocationsUpdates` is a slim companion table that keeps only:

- `VesselAbbrev`
- `TimeStamp`
- `VesselLocationId` (typed as `v.id("vesselLocations")`)

This provides the minimal state needed to detect changes and directly replace live rows by ID.

## Bandwidth motivation

Convex charges Database I/O based on document/index bytes moved between functions and the backing database.  
For this loop, the key optimization is:

- **Read small docs for dedupe** (`vesselLocationsUpdates`)
- **Avoid scanning full `vesselLocations`** on each ping
- **Write only changed rows** when timestamps advance

In short: the orchestrator performs cheap reads for change detection and avoids unnecessary heavy reads/writes.

## How it works

1. Orchestrator computes normalized `convexLocations`.
2. Orchestrator reads all rows from `vesselLocationsUpdates`.
3. It builds `Map<VesselAbbrev, TimeStamp>` and filters `changedLocations` where timestamp changed or is missing.
4. If no rows changed, it skips mutation invocation entirely.
5. If rows changed, it calls one combined mutation:
   - Upsert/replace the corresponding `vesselLocations` row
   - Upsert the `vesselLocationsUpdates` row with latest timestamp and linked `VesselLocationId`

## Why writes are combined

The combined mutation updates both tables in one transaction and one function invocation:

- Keeps location and update-signature state in sync
- Avoids extra invocation overhead
- Preserves clear single-write-path semantics for this optimization

## Design notes

- This table is intentionally narrow and single-purpose.
- A full-table `collect()` is acceptable here because cardinality is bounded (roughly one row per vessel).
- The table is not intended as a general query surface; it is an internal dedupe mechanism for orchestrator pings.
