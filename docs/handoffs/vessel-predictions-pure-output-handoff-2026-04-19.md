# Handoff: `updateVesselPredictions` pure-output cleanup

**Date:** 2026-04-19  
**Audience:** engineer or agent implementing the next `updateVesselPredictions`
refactor pass  
**Status:** architectural handoff for the next implementation pass

## Primary reference

Read this PRD first and treat it as the source of truth for the next pass:

- [`vessel-predictions-pure-output-prd.md`](../engineering/vessel-predictions-pure-output-prd.md)

Read these as active supporting context:

- [`vessel-trips-pure-output-prd.md`](../engineering/vessel-trips-pure-output-prd.md)
- [`vessel-trips-prediction-policy-north-star-memo.md`](../engineering/vessel-trips-prediction-policy-north-star-memo.md)
- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)

## Why this is the next cleanup

`updateVesselTrips` has now been flattened into a pure trip-update pipeline with
a narrow public boundary:

- [runUpdateVesselTrips.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/runUpdateVesselTrips.ts)
- [contracts.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/contracts.ts)

That refactor intentionally left the seam in
[actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/actions.ts)
unfinished downstream. The next logical step is to give
`updateVesselPredictions` the same treatment:

- pure function
- plain-data input
- row-oriented output
- no direct DB writes
- no compatibility artifacts preserved only for downstream consumers

## Direction for the next pass

The important architectural move is:

- `updateVesselTrips` owns authoritative trip rows
- `updateVesselPredictions` consumes those rows
- `updateVesselPredictions` returns prediction-row DTOs for the current tick
- `actions.ts` owns dedupe and upsert

The predictions concern should stop explaining itself as “attach predictions to
trip-shaped objects and persist around special events.”

Instead, it should explain itself as:

- every tick, compute the prediction rows that should exist for the current trip
  state
- return those rows
- let functions decide whether each row actually needs to be written

## What not to optimize prematurely

Do not spend the next pass trying to perfect every internal detail of
`updateVesselPredictions` before the boundary is correct.

The boundary is the main objective:

- pure pipeline
- prediction-row DTO output
- simple seam in `actions.ts`
- downstream adaptation instead of bridge outputs

Temporary compile breakage in downstream consumers is acceptable if it helps
surface invalid dependencies.

## Advice from the trip refactor

- Deletion is the default. If a file or type exists only to preserve an old
  orchestration story, remove it.
- Keep the top-level files aligned with the business flow rather than historical
  abstractions.
- Avoid compatibility outputs that exist only to make `actions.ts`, timeline,
  or persistence code comfortable.
- Keep input types minimal in terms of owned concerns, not by over-filtering
  data before the function runs.
- Ask whether each remaining public type would still be invented if
  `updateVesselPredictions` were written from scratch today.

## Suggested starting point

Begin by reading the current public surface and caller path:

- [convex/domain/vesselOrchestration/updateVesselPredictions/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/index.ts)
- [convex/domain/vesselOrchestration/updateVesselPredictions/contracts.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/contracts.ts)
- [convex/functions/vesselOrchestrator/actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/actions.ts)

Then align the implementation with the new PRD before worrying about local
beautification.
