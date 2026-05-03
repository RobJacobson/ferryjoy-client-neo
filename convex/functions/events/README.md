# Event functions

This subtree owns Convex-facing persistence modules for the event tables.

## Rules

- one folder per table
- `shared/` is only for persistence helpers shared across the event tables
- keep business policy in `convex/domain/`; mutation helpers may call pure
  domain planners and then apply the resulting DB operations

## Tables

- `eventsActual/`
- `eventsPredicted/`
- `eventsScheduled/`
