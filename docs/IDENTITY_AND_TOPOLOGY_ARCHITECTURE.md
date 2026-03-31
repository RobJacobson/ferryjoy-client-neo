# Identity And Topology Architecture

This document describes the current backend and frontend architecture for
canonical vessel identity, terminal identity, and derived route topology.

## Scope

This system exists to remove hard-coded vessel and terminal lookup tables as
the primary source of truth while still keeping the app fast at startup and
resilient when offline or disconnected.

It covers:

- backend identity tables
- backend topology derivation
- Convex refresh jobs and public snapshot queries
- committed frontend fallback assets
- frontend local-storage and in-memory persistence

## Backend Tables

### `vessels`

Canonical WSF vessel identity rows.

Current shape:

```ts
type Vessel = {
  VesselID: number;
  VesselName: string;
  VesselAbbrev: string;
  UpdatedAt?: number;
};
```

This table is a slim mirror of WSF vessel basics.

### `terminals`

Canonical terminal and marine-location rows used by the backend.

Current shape:

```ts
type Terminal = {
  TerminalID: number;
  TerminalName: string;
  TerminalAbbrev: string;
  IsPassengerTerminal?: boolean;
  Latitude?: number;
  Longitude?: number;
  UpdatedAt?: number;
};
```

Important notes:

- passenger terminals remain canonical
- the table also allows a small number of known non-passenger marine locations
  referenced by the WSF vessel feed
- today that includes seeded rows such as `EAH` and `VIG`
- `IsPassengerTerminal !== false` is treated as passenger-terminal behavior

This lets vessel-location ingestion stay simple even when WSF reports a
shipyard or maintenance location as a terminal-like abbrev.

### `terminalsTopology`

Derived route topology rows keyed by departing terminal abbreviation.

Current shape:

```ts
type TerminalTopology = {
  TerminalAbbrev: string;
  TerminalMates: string[];
  RouteAbbrevs: string[];
  RouteAbbrevsByArrivingTerminal: Record<string, string[]>;
  UpdatedAt?: number;
};
```

Important notes:

- this table is derived from WSF schedule data, not hand-maintained
- it stores one row per departing terminal
- it excludes non-passenger marine locations
- it is intentionally operational and derived, not canonical terminal identity

## Refresh Model

The backend owns refresh and derivation.

### Cron Jobs

Hourly Convex jobs refresh:

- `vessels`
- `terminals`
- `terminalsTopology`

### Terminal Refresh

Terminal refresh flow:

1. fetch WSF terminal basics
2. normalize/trim identity fields
3. mark fetched rows as passenger terminals
4. append a tiny seeded list of known marine locations omitted by WSF basics
5. persist by `TerminalAbbrev`

### Topology Refresh

Topology refresh flow:

1. load backend terminals
2. filter to passenger terminals only
3. fetch terminal mates from WSF schedule APIs
4. fetch route data for each valid terminal pair
5. derive one topology row per departing terminal
6. persist rows by `TerminalAbbrev`

## Vessel-Location Ingestion Rules

The vessel feed still flows through canonical backend tables, but with a small
graceful-degradation rule for unknown future marine locations.

Behavior:

- vessel identity must resolve or the row is dropped
- known passenger terminals resolve canonically
- known seeded marine locations resolve canonically through `terminals`
- unknown future marine-location abbrevs are preserved as raw abbrev/name in
  vessel locations so live state is not lost
- distance-to-terminal is only computed when a location resolves against a row
  with coordinates
- trip processing only receives passenger-terminal rows

This keeps live vessel state visible without polluting route and trip logic.

## Public Snapshot Queries

The frontend hydrates from three public Convex snapshot queries:

- `getFrontendVesselsSnapshot`
- `getFrontendTerminalsSnapshot`
- `getFrontendTerminalsTopologySnapshot`

The topology query now returns an array of per-terminal rows, not one global
blob.

## Frontend Persistence Model

The frontend uses three layers for each dataset:

1. live Convex query result
2. local storage
3. committed asset fallback

Effective precedence:

```ts
fromConvex ?? fromLocalStorage ?? fromAsset
```

Each dataset resolves independently.

### Committed Assets

Committed assets live under:

- `assets/data/vessels.json`
- `assets/data/terminals.json`
- `assets/data/terminalsTopology.json`

These are generated from Convex snapshot queries so fallback data matches the
runtime contract.

### Local Storage

The client persists every successful Convex snapshot payload to local storage.

If cached data becomes incompatible with the current schema, the client should
discard that blob and fall back to the committed asset until fresh Convex data
arrives.

### In-Memory Catalog

The frontend `IdentityProvider` loads those three datasets and builds fast
lookup indexes in memory for:

- vessels by abbrev, id, and name
- terminals by abbrev, id, and name
- topology by terminal abbrev

The topology snapshot is stored on the client as an array, but the in-memory
catalog indexes it by `TerminalAbbrev` so call sites can still do direct
abbreviation lookups.

## Why Topology Is Per-Terminal Rows

`terminalsTopology` originally started as a single blob, but it is now stored
as one row per terminal because that better matches the domain and persistence
model.

Benefits:

- clearer schema ownership
- easier inspection in Convex
- no artificial `"global"` key wrapper
- simpler future incremental updates if needed
- frontend still gets a compact snapshot, but storage stays normalized enough to
  reason about

## Boundaries

Canonical:

- `vessels`
- `terminals`

Derived:

- `terminalsTopology`

Excluded from topology and route derivation:

- non-passenger marine locations such as shipyards and maintenance facilities

## Related Files

- [convex/functions/vessels/actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vessels/actions.ts)
- [convex/functions/terminals/actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/terminals/actions.ts)
- [convex/functions/terminalsTopology/actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/terminalsTopology/actions.ts)
- [convex/functions/vesselLocation/schemas.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocation/schemas.ts)
- [src/data/contexts/IdentityContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/IdentityContext.tsx)
- [src/data/identity/catalog.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/identity/catalog.ts)
- [scripts/generate-identity-assets.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/scripts/generate-identity-assets.ts)
