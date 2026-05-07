# Events Old-Code-First Stage 1 Scheduled Schemas Handoff

## Stage Scope

Reduce `convex/functions/events/eventsScheduled/schemas.ts` against
`events-old-reference`, keeping only current additions required by live callers
or current table compatibility.

Default editable files:

- `convex/functions/events/eventsScheduled/schemas.ts`
- this handoff note

Inspect callers, tests, and nearby schemas as needed. Do not edit other files
unless the schema cannot be simplified safely without a tiny import or type
adjustment; report that need before expanding scope.

## Old-Code Trace Summary

Old `eventsScheduled/schemas.ts` defines:

- local `dockEventTypeSchema`
- `eventsScheduledSchema` with scheduled dock row fields
- `ConvexScheduledDockEvent` inferred from the schema

The old schema file is the full trace for this stage: it exports validators and
the inferred row type, with no helper flow beyond the Convex object validator.

Stage 1 restored that self-contained shape. The only retained addition beyond
old code is the `DockEventType` type alias, because the current scheduled barrel
already re-exports it and removing that export would require expanding the stage
into the barrel surface.

## Current-Code Delta Table

| Current addition beyond old code | Keep/delete | Reason |
| --- | --- | --- |
| Shared `dockEventTypeSchema` import from `../common/schemas` | Delete | Old code defined the validator locally, and scheduled schema does not need the shared helper to stay readable. |
| Local `dockEventTypeSchema` export | Keep | Matches old code and is imported by the current scheduled barrel. |
| `DockEventType` type re-export | Keep | No live production caller imports it directly, but the current scheduled barrel re-exports it; keeping the alias preserves compatibility without editing out-of-scope files. |
| Expanded module comment | Delete | The shorter old-style module comment is sufficient for this schema-only file. |

## LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| `convex/functions/events/eventsScheduled/schemas.ts` | 26 | 28 | 28 |

Updated code is substantially the same as old code. It is two raw lines longer
only because it preserves the current `DockEventType` type export required by
the existing scheduled barrel.

## Verification Run Or Blocker

Ran:

```sh
bun test convex/functions/events/eventsScheduled/tests/listScheduledDockEventsForVesselSailingDay.test.ts convex/functions/events/eventsScheduled/tests/upsertScheduledRowsForSailingDay.test.ts
```

Result: 8 pass, 0 fail.

## Recommendation

Proceed to Stage 2. During the later barrel/export cleanup stage, remove
`DockEventType` from the scheduled public surface if no live caller has appeared;
that would let this file match the old 26 raw lines exactly.
