## Data hooks

Hooks in this folder are responsible for **data fetching/caching** (TanStack Query,
ws-dottie, Convex, etc). Keep pure transformation logic in domain modules (e.g.
`src/domain/schedule/`) so it can be reused and tested without React.

