# VesselTrips `updates/` — module boundaries (Stage 1)

This note complements [`README.md`](./README.md). Stage 1 adds explicit contracts in [`contracts.ts`](./contracts.ts); **Stage 3** may tighten import rules (e.g. lifecycle modules not importing projection builders from `domain/vesselTimeline`).

## Checklist

- **Lifecycle** — Trip boundary detection, active/completed persistence, and strip-on-write live in `processVesselTrips/`, `buildTrip.ts`, `buildCompletedTrip.ts`, `mutations.ts` (callers), `stripTripForStorage.ts`. Stored rows omit the five boundary ML fields.
- **Timeline overlays** — `eventsActual` / `eventsPredicted` projection payloads are built in branch processors (`processCompletedTrips`, `processCurrentTrips`) and applied **after** lifecycle mutations succeed (`processVesselTrips`).
- **Read-model hydration** — Queries and orchestrator read models join `eventsPredicted` via `hydrateTripPredictions.ts`; not part of the synchronous tick mutation chain.
- **Orchestrator** — May bundle `activeTrips` into the tick to avoid an extra `getActiveTrips` query; ordering inside `processVesselTrips` is independent of `Promise.allSettled` with `updateVesselLocations`.

## Forward (Stage 3)

- Document allowed shared types vs forbidden projection-builder imports from lifecycle files when that stage lands.
