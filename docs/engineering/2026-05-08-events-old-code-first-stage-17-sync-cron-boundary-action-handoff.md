# Events Old-Code-First Stage 17 Sync Cron Boundary Action Handoff

## Stage Scope

Review the cron-facing dock-event reload boundary action against the old
VesselTimeline boundary sync flow.

This stage covers:

- `reloadDockEventsAtSailingDayBoundary` in
  `convex/functions/events/sync/actions.ts`
- DST cron wiring in `convex/crons.ts` only if the boundary action cannot be
  reviewed safely without a tiny naming/reference adjustment
- `convex/functions/events/sync/tests/reloadDockEventsAtSailingDayBoundary.test.ts`

Stage 18 owns public/manual/operator reload actions. Stage 19 owns sync
internal mutations and reload payload validators. Do not rewrite those surfaces
in this stage. `runReloadDockEventsWindow` is relevant as the callee, but
window helper cleanup belongs here only if the boundary action requires it;
otherwise leave it for a later sync/manual review.

Default editable files:

- `convex/functions/events/sync/actions.ts`
- `convex/functions/events/sync/tests/reloadDockEventsAtSailingDayBoundary.test.ts`
- this handoff note
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

Optional inspection/edit file:

- `convex/crons.ts`

Do not edit reload domain builders, sync mutations, reload data schemas,
single-day reload action helpers, generated files, or public/manual action
callers unless the boundary action cannot be safely simplified without a tiny
compatibility adjustment. If that happens, stop and report the exact blocker
before expanding scope.

## Required Reading

Read before implementation:

- `docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- `.cursor/rules/code-style.mdc`
- `docs/convex_rules.mdc`
- `docs/engineering/2026-05-08-events-old-code-first-stage-10-actual-static-reload-handoff.md`

Use `events-old-reference` as the implementation baseline. Do not use
`events-current-reference` unless the owner explicitly asks for archaeology.

## Old-Code Trace Summary

Read:

- `events-old-reference:convex/functions/vesselTimeline/actions.ts`
- `events-old-reference:convex/functions/vesselTimeline/sync/syncWindowedVesselTimeline.ts`
- `events-old-reference:convex/crons.ts`
- current `convex/functions/events/sync/actions.ts`
- current `convex/functions/events/sync/reloadDockEventsWindow.ts`
- current `convex/crons.ts`
- current boundary test

Old boundary flow:

1. `convex/crons.ts` registered two UTC cron entries for the daily boundary
   sync, one for the DST UTC candidate and one for the standard-time UTC
   candidate.
2. Both cron entries called
   `internal.functions.vesselTimeline.index.syncVesselTimelineAtSailingDayBoundary`
   with `{ daysToSync: 2 }`.
3. The internal action accepted optional `daysToSync`.
4. The action read `getPacificTimeComponents(new Date())`.
5. If Pacific hour was not `3`, it returned a skip result:
   `skipped: true`, reason `"outside_pacific_3am_window"`, zero totals, and an
   empty `daysProcessed` array.
6. If Pacific hour was `3`, it returned `skipped: false` plus the result from
   `syncWindowedVesselTimeline(ctx, args.daysToSync)`.

Current boundary flow is the same shape with event-table names:

- `convex/crons.ts` registers DST and standard cron entries that call
  `internal.functions.events.sync.index.reloadDockEventsAtSailingDayBoundary`
  with `{ daysToSync: 2 }`.
- `reloadDockEventsAtSailingDayBoundary` applies the same Pacific hour-three
  guard and delegates to `runReloadDockEventsWindow`.

Raw LoC:

- old `functions/vesselTimeline/actions.ts`: 84
- old `functions/vesselTimeline/sync/syncWindowedVesselTimeline.ts`: 69
- old `convex/crons.ts`: 122
- current `functions/events/sync/actions.ts` before Stage 17: 91
- current `functions/events/sync/reloadDockEventsWindow.ts` before Stage 17: 64
- current `convex/crons.ts` before Stage 17: 121
- current boundary test before Stage 17: 70

## Current-Code Delta Table

| Delta beyond old boundary flow | Default decision | Reason |
| --- | --- | --- |
| Event-table naming instead of VesselTimeline naming | Keep | Current generated API path and table split use `functions.events.sync.index`. |
| Public/manual reload actions in same `actions.ts` file | Defer | Stage 18 owns manual/operator actions. Do not count their lines as a Stage 17 success/failure without separating scope. |
| `reloadDockEventsWindow` internal action wrapper | Keep for Stage 17 unless boundary simplification requires change | Boundary action delegates through it just like old code delegated through windowed sync. |
| Pacific hour-three guard | Keep unless owner changes schedule policy | This is the DST-safe guard that prevents the two UTC crons from double-running outside local 3 AM. |
| Two cron entries in `convex/crons.ts` | Keep unless a better Convex scheduling primitive exists locally | Convex cron expressions are UTC-only; the old and current flows both use two UTC candidates plus the local-hour guard. |
| Boundary test | Keep or trim only if obvious | It verifies both skip and run paths without exercising reload internals. |

## Hard Acceptance Bar

The current boundary action appears close to the old flow. A valid Stage 17
result may be a no-op if the worker confirms:

- the current action still follows the old Pacific-hour guard and window
  delegation;
- the two current cron entries are the old DST-safe pattern translated to the
  event-table path;
- any remaining extra code in `actions.ts` belongs to Stage 18 manual/operator
  actions, not this boundary stage.

Do not delete the local-hour guard or collapse the two crons to one UTC time
without owner approval. Do not use this stage to refactor the window helper,
single-day reload, payload construction, or reload mutations.

## Required Worker Report

The result must include:

1. Old boundary-action LoC and old cron/window context LoC.
2. Current production LoC before edits.
3. Updated production LoC after edits.
4. Old/current/updated focused test LoC if tests are touched.
5. A complete old-flow trace from cron entry to skip/window result.
6. A delta table explaining every meaningful difference from old code.
7. A clear recommendation: approve edits, no-op, or blocker.

If code changes are made, update this handoff with a Worker Result section and
update the stage log after verification. If no code changes are appropriate,
record the no-op result and update the stage log only if appropriate.

## Verification

If code or tests change, run:

```sh
bun test convex/functions/events/sync/tests/reloadDockEventsAtSailingDayBoundary.test.ts
```

Run broader type checks only if action exports, generated API paths, or cron
references change:

```sh
bun run type-check
bun run convex:typecheck
```

If no code or test files change, verification may be a blocker-free review
report plus raw LoC confirmation.

## Recommendation

This is likely a no-op stage. The current boundary action is already a direct
translation of the old VesselTimeline boundary action, and the apparent extra
sync surface in `actions.ts` belongs to Stage 18 unless the worker finds a real
boundary-specific simplification.

## Worker Result

The Stage 17 local worker/orchestrator review recommends approving this stage
as a no-op.

### Old-Flow Trace

Old `convex/crons.ts` registered two UTC cron entries for the daily
VesselTimeline boundary sync: one at the DST candidate and one at the standard
time candidate. Both entries passed `{ daysToSync: 2 }` to
`internal.functions.vesselTimeline.index.syncVesselTimelineAtSailingDayBoundary`.

Old `syncVesselTimelineAtSailingDayBoundary` accepted optional `daysToSync`,
read Pacific time components from `new Date()`, and returned a skip payload
outside Pacific hour three. During Pacific hour three, it returned
`skipped: false` plus the windowed sync result from
`syncWindowedVesselTimeline(ctx, args.daysToSync)`.

Current `reloadDockEventsAtSailingDayBoundary` is the same boundary flow with
the generated API path translated to
`internal.functions.events.sync.index.reloadDockEventsAtSailingDayBoundary` and
the callee translated to `runReloadDockEventsWindow`.

### LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| `functions/vesselTimeline/actions.ts` / `functions/events/sync/actions.ts` | 84 | 91 | 91 |
| Old/current window helper context | 69 | 64 | 64 |
| `convex/crons.ts` | 122 | 121 | 121 |
| Focused boundary test | 0 | 70 | 70 |

No production or test files were edited.

### Delta Table

| Current addition beyond old boundary flow | Keep/delete | Reason |
| --- | --- | --- |
| Event-table generated API path | Keep | Current dock-event reload lives under `functions.events.sync.index`; the old `vesselTimeline` path no longer owns these tables. |
| Two UTC cron entries | Keep | This is the old DST-safe pattern; Convex cron expressions are UTC-only and the action guard prevents the non-3 AM candidate from running work. |
| Pacific hour-three guard | Keep | It is the safety check that makes the two-cron schedule correct. |
| `runReloadDockEventsWindow` delegation | Keep | It is the direct equivalent of old `syncWindowedVesselTimeline` delegation. |
| Public/manual actions sharing `actions.ts` | Defer | Stage 18 owns manual/operator action surface review. |
| Boundary test | Keep | It verifies the skip path and run path without coupling to reload internals. |

### Verification

No tests were run because no production code or test code changed.

### Recommendation

Approve Stage 17 as a no-op. The current cron boundary action is already the
old VesselTimeline DST-safe boundary flow translated to event-table reloads;
meaningful sync action reduction belongs to Stage 18 or Stage 19.
