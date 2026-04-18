# Event functions

This subtree owns Convex-facing persistence modules for the event tables.

## Rules

- one folder per table
- `shared/` is only for persistence helpers shared across the event tables
- no business logic here
- no imports from `convex/domain/`

## Tables

- `eventsActual/`
- `eventsPredicted/`
- `eventsScheduled/`
