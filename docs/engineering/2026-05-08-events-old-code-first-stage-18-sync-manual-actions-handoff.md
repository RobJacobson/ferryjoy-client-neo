# Events Old-Code-First Stage 18 Sync Manual Actions Handoff

## Stage Scope

Review the manual/operator dock-event reload actions in
`convex/functions/events/sync/actions.ts` against the old VesselTimeline manual
sync actions.

This stage covers:

- `reloadDockEventsForCurrentSailingDay`
- `reloadDockEventsForSailingDay`
- `reloadDockEventsWindow`, only as the internal recovery/window action surface
  adjacent to manual operation
- `convex/functions/events/sync/actions.ts`
- this handoff note
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

Stage 17 already approved the cron boundary action as a no-op. Stage 19 owns
sync internal mutations and reload payload validators. Do not rewrite
single-day reload internals, payload construction, reload mutations, reload
schemas, generated files, or cron wiring in this stage.

## Required Reading

Read before implementation:

- `docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- `.cursor/rules/code-style.mdc`
- `docs/convex_rules.mdc`
- `docs/engineering/2026-05-08-events-old-code-first-stage-17-sync-cron-boundary-action-handoff.md`

Use `events-old-reference` as the implementation baseline. Do not use
`events-current-reference` unless the owner explicitly asks for archaeology.

## Old-Code Trace Summary

Read:

- `events-old-reference:convex/functions/vesselTimeline/actions.ts`
- current `convex/functions/events/sync/actions.ts`
- current `convex/functions/events/sync/index.ts`
- current `package.json`
- current `scripts/sync-dock-events.ts`
- current docs/PRD references to manual/operator reload actions

Old manual/operator flow:

1. `syncVesselTimelineManual` was a public action with no args.
2. It derived the current sailing day with `getSailingDay(new Date())`.
3. It delegated to `reseedVesselTimelineForDate(ctx, sailingDay)`.
4. `syncVesselTimelineForDateManual` was a public action with `targetDate`.
5. It delegated directly to `reseedVesselTimelineForDate(ctx,
   args.targetDate)`.
6. `syncVesselTimelineWindowed` was an internal action for windowed recovery or
   backfill, accepting optional `daysToSync` and delegating to
   `syncWindowedVesselTimeline`.

Current manual/operator flow is the same shape with event-table names:

- `reloadDockEventsForCurrentSailingDay` derives the current sailing day and
  delegates to `runReloadDockEventsForSailingDay`.
- `reloadDockEventsForSailingDay` accepts `targetDate` and delegates to
  `runReloadDockEventsForSailingDay`.
- `reloadDockEventsWindow` accepts optional `daysToSync` and delegates to
  `runReloadDockEventsWindow`.
- `package.json` exposes `sync:dock-events`, which runs
  `scripts/sync-dock-events.ts`.
- `scripts/sync-dock-events.ts` calls the two public Convex actions through
  the generated API, using the current-day action by default and the explicit
  date action when a `YYYY-MM-DD` argument is passed.

Raw LoC:

- old `functions/vesselTimeline/actions.ts`: 84
- old manual/current-date/window action slice: about 43 raw lines
- current `functions/events/sync/actions.ts` before Stage 18: 91
- current manual/current-date/window action slice: about 45 raw lines

## Current-Code Delta Table

| Delta beyond old manual/operator flow | Default decision | Reason |
| --- | --- | --- |
| Event-table action names | Keep | Current generated API path owns dock-event reloads, not old VesselTimeline rows. |
| Public current-day reload action | Keep | Old code exposed the same operator convenience, and `scripts/sync-dock-events.ts` calls this action when no date is passed. |
| Public explicit-date reload action | Keep | Old code exposed the same manual backfill surface, and `scripts/sync-dock-events.ts` calls this action when a date is passed. |
| Internal window action | Keep unless owner rejects recovery surface | Old code exposed a windowed internal action for recovery/backfill, and the cron boundary also uses the same window helper. |
| Separate single-day/window helper modules | Defer | This stage reviews action surface. Collapsing helper files belongs to broader sync architecture work if pursued. |

## Worker Result

Stage 18 is approved as a no-op by local orchestrator review.

### Old-Flow Trace

The old VesselTimeline action surface had two public manual actions and one
internal window action. The public current-day action computed the current
sailing day and delegated to the single-day reseed helper. The public explicit
date action delegated to the same helper with `targetDate`. The internal window
action delegated to the window helper with optional `daysToSync`.

Current dock-event reload actions preserve that same operator surface with
event-table naming and the current `runReloadDockEventsForSailingDay` /
`runReloadDockEventsWindow` helpers. The public actions also have a concrete
local operator caller: `package.json` exposes `sync:dock-events`, which runs
`scripts/sync-dock-events.ts`; that script calls the current-day action by
default and the explicit-date action when a sailing-day argument is supplied.

### LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| Full action file | 84 | 91 | 91 |
| Manual/current-date/window action slice | about 43 | about 45 | about 45 |
| Focused tests | 0 | 0 | 0 |

No production or test files were edited.

### Delta Table

| Current addition beyond old manual/operator flow | Keep/delete | Reason |
| --- | --- | --- |
| Event-table naming and generated API path | Keep | Current reload writes `eventsScheduled` and `eventsActual`, not old `vesselTimeline` rows. |
| `reloadDockEventsForCurrentSailingDay` | Keep | Mirrors old current-day public manual action and is called by `scripts/sync-dock-events.ts` when no date is passed. |
| `reloadDockEventsForSailingDay` | Keep | Mirrors old explicit-date public manual action and is called by `scripts/sync-dock-events.ts` for targeted backfill. |
| `reloadDockEventsWindow` internal action | Keep | Mirrors old internal windowed recovery action; cron boundary also relies on the window helper. |
| Helper-module split | Defer | Meaningful collapse of helper files is a broader sync-code reduction question, not action-surface review. |

### Verification

No tests were run because no production code or test code changed.

### Recommendation

Approve Stage 18 as a no-op. The manual/operator action surface is the old
VesselTimeline surface translated to dock-event reloads, and removing it would
break the checked-in `sync:dock-events` operator script rather than reduce
unnecessary architecture.
