# Convex adapters

`convex/adapters/` contains translation and integration code that sits at the
boundary between external systems and FerryJoy's backend-owned types.

## What belongs here

- WSF fetch wrappers
- raw vendor types
- mapping from vendor payloads into backend inputs
- identity resolution tied to vendor payload semantics

## What does not belong here

- Convex `query`, `mutation`, `action`, or `internalAction` registration
- business rules or lifecycle decisions owned by `convex/domain/`
- generic utilities with no vendor or boundary story

## Import guidance

- `convex/functions/` may call adapters to fetch or translate boundary data
  before delegating to `convex/domain/`
- `convex/domain/` may consume adapter-owned types when needed, but should not
  depend on Convex function implementation modules
- prefer small functional modules with one public export per file when practical
- avoid broad barrels; add an `index.ts` only for a narrow, intentional surface
