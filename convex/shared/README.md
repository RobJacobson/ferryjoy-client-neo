# Convex shared

`convex/shared/` is reserved for small cross-cutting helpers that do not own a
vendor boundary story.

## What belongs here

- generic time and key helpers
- data-shape utilities
- cross-module comparisons and grouping helpers

## What does not belong here

- WSF fetch wrappers
- WSF raw payload types
- mapping from WSF payloads into backend rows
- source-specific identity resolution rules for schedule or vessel-history feeds
- backend feature-specific identity lookup helpers

Boundary-specific logic should live in `convex/adapters/`.
