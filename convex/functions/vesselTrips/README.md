# VesselTrips (Convex functions)

Thin Convex entrypoints for vessel trips:

- **`queries.ts`** — Indexed reads; delegates hydration to `domain/vesselTrips/read/`.
- **`mutations.ts`** — Persistence and depart-next backfill; policy helpers in `domain/vesselTrips/mutations/`.
- **`schemas.ts`** — Validators and API/domain conversion helpers.
- **`actions.ts`** — Per-tick processing (`processVesselTrips`), schedule adapters (`appendFinalSchedule`, `resolveEffectiveLocation`), and default `loadActiveTrips` wiring.

Lifecycle rules, projection assembly, and tick orchestration live under **`convex/domain/vesselTrips/`**.

For the full pipeline narrative (debounce, boundaries, projection ordering), see the archived design notes in repo history or `docs/handoffs` PRDs.

## Tests

- **Domain**: `bun test convex/domain/vesselTrips/**/*.test.ts`
- **Schema / wiring**: `bun test convex/functions/vesselTrips/tests/*.test.ts`
