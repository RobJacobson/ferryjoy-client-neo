# Identity Data Contexts

This folder holds three foundational client data stores:

- vessels
- terminals
- terminals topology

They live in a special folder because they bootstrap differently than ordinary
feature state, but the client API is intentionally plain React data contexts.

## Backend Domain Model

Backend ownership is unchanged:

- `vessels` contains canonical WSF vessel identity rows
- `terminals` contains canonical passenger terminals plus a small set of known
  marine locations needed by live vessel ingestion
- `terminalsTopology` contains derived route topology keyed by departing
  terminal abbreviation

`vessels` and `terminals` are canonical identity tables. `terminalsTopology` is
derived operational data built from schedule APIs.

The frontend still consumes the same public Convex snapshot queries:

- `getFrontendVesselsSnapshot`
- `getFrontendTerminalsSnapshot`
- `getFrontendTerminalsTopologySnapshot`

## Frontend Client Stores

The client does not consume an in-memory catalog or a subscription API anymore.
Instead, it consumes three ordinary React contexts:

- `useVesselsData`
- `useTerminalsData`
- `useTerminalsTopologyData`

Each context exposes:

- `data` for the raw snapshot array
- derived lookup maps such as `vesselsByAbbrev`, `terminalsById`, or
  `terminalsTopologyByAbbrev`

The lookup maps are derived convenience data for fast reads. They are not a
separate persistence concept and they are rebuilt from the active raw array.

The underlying stores still retain debug metadata including:

- `source`, which reports whether the active dataset currently came from the
  compiled asset, local storage, or Convex
- `isHydrated`, which reports whether the async storage read has completed

In normal app code, identity consumers are expected to read the indexed maps
directly. Small adapter modules still exist, but they now live close to the
features that need them rather than hiding ordinary object lookups behind
generic selectors.

## Layered Loading Model

Each dataset resolves from three sources with strict precedence:

1. compiled asset
2. local storage
3. Convex

Behavior:

- the asset is available synchronously on first render
- storage hydrates asynchronously and may replace the asset while offline
- Convex replaces the active dataset when live data arrives
- once Convex wins, storage is never allowed to overwrite it later
- corrupt persisted JSON blobs are discarded automatically during hydration

This gives the app graceful startup and offline behavior without forcing app
code to understand the loading choreography.

## Current Boundaries

This folder is the canonical source of truth for identity snapshots and indexed
lookup records.

What still belongs here:

- bootstrapping layered datasets from asset, storage, and Convex
- exposing canonical snapshots through React contexts
- deriving shared lookup maps such as `terminalsByAbbrev` and
  `terminalsTopologyByAbbrev`

What no longer belongs here:

- feature-specific view models
- thin wrappers around direct indexed lookups
- presentation adapters for one screen or component

Examples:

- the home carousel terminal-card adapter now lives in
  [terminalCards.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/RoutesCarousel/model/terminalCards.ts)
- the map-only terminal/topology join helper remains in
  [terminalLocations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/terminalLocations.ts)
  because it is still reused by the terminal slug map flow
- the schedules screen still uses
  [terminalRouteMapping.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/terminalRouteMapping.ts)
  to translate terminal selection into route query params

## Key Files

- [useLayeredDataset.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/identity/useLayeredDataset.ts)
- [VesselsDataContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/identity/VesselsDataContext.tsx)
- [TerminalsDataContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/identity/TerminalsDataContext.tsx)
- [TerminalsTopologyDataContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/identity/TerminalsTopologyDataContext.tsx)
- [datasets.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/identity/datasets.ts)
- [terminalLocations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/terminalLocations.ts)
- [terminalCards.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/RoutesCarousel/model/terminalCards.ts)
- [terminalRouteMapping.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/terminalRouteMapping.ts)
