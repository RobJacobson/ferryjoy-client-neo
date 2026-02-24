# Handoff: Refactor VesselTrips to Use ScheduledTrip References

## Context and Decision

We are refactoring from **denormalized** to **normalized** data model for the VesselTrips → ScheduledTrips relationship.

### Current State (Denormalized)
VesselTrip documents contain entire `ScheduledTrip` object as a nested field:

```typescript
// convex/functions/vesselTrips/schemas.ts (line 100)
export const vesselTripSchema = v.object({
  // ... other fields
  ScheduledTrip: v.optional(scheduledTripSchema), // Full object embedded
});
```

### New State (Normalized)
VesselTrip documents will store only a reference (ID) to ScheduledTrip:

```typescript
// convex/functions/vesselTrips/schemas.ts (proposed)
export const vesselTripSchema = v.object({
  // ... other fields
  scheduledTripId: v.optional(v.id("scheduledTrips")), // Reference only
});
```

### Why This Change?

After careful analysis, refs are preferred for our use case because:

1. **Backend Caching**: Convex aggressively caches data using memcache. Additional `ctx.db.get()` calls to fetch ScheduledTrips by ID are essentially free (cache hits) since schedule data (~500 rows/day) is frequently accessed.

2. **ScheduledTrips Are Master Data**: We need to fetch all ScheduledTrips for any given sailing day regardless of VesselTrip data (for route displays, future trips, planning). Current approach duplicates data we'd fetch anyway.

3. **Manual Joins Are Efficient**: Backend queries can join both tables on the server (same runtime, cached data), returning complete data to client. This is Convex's intended pattern for relationships.

4. **Single Source of Truth**: Eliminates data redundancy, reduces storage, and ensures consistency if schedule data changes.

See [Convex Document IDs documentation](https://docs.convex.dev/database/document-ids.md) for reference pattern details.

---

## Architecture Impact

### Files Requiring Changes

#### 1. Schema Definitions
**File**: `convex/functions/vesselTrips/schemas.ts`

**Changes**:
- Replace `ScheduledTrip: v.optional(scheduledTripSchema)` with `scheduledTripId: v.optional(v.id("scheduledTrips"))`
- Update `ConvexVesselTrip` type inference (automatically handled by `Infer<typeof vesselTripSchema>`)
- Update `VesselTrip` domain type to remove `ScheduledTrip` field, add `scheduledTripId?: Id<"scheduledTrips">`
- Update `toDomainVesselTrip` to handle ref instead of nested object
- Update `toConvexVesselTrip` to accept `scheduledTripId` instead of `ScheduledTrip`

#### 2. Schedule Lookup Functions
**File**: `convex/functions/vesselTrips/updates/buildTripWithSchedule.ts`

**Current Behavior**: Functions fetch and embed full `ScheduledTrip` object into VesselTrip.

**New Behavior**: Functions should return `Id<"scheduledTrips">` instead.

**Functions to update**:
- `buildTripWithInitialSchedule`: Return `scheduledTrip._id` instead of entire `scheduledTrip` object
- `buildTripWithFinalSchedule`: Return `scheduledTrip._id` instead of entire `scheduledTrip` object

**Example**:

```typescript
// CURRENT (line 52-56)
if (scheduledTrip) {
  return {
    ...baseTrip,
    ArrivingTerminalAbbrev: scheduledTrip.ArrivingTerminalAbbrev,
    ScheduledTrip: scheduledTrip, // Full object
  };
}

// NEW (proposed)
if (scheduledTrip) {
  return {
    ...baseTrip,
    ArrivingTerminalAbbrev: scheduledTrip.ArrivingTerminalAbbrev,
    scheduledTripId: scheduledTrip._id, // ID only
  };
}
```

**Important**: We still need to extract `ArrivingTerminalAbbrev` from `scheduledTrip` before returning the ID. This field is not available in VesselLocation for arrival lookups.

#### 3. Query Functions
**File**: `convex/functions/vesselTrips/queries.ts`

**Current Behavior**: Queries return VesselTrips with embedded `ScheduledTrip` data.

**New Behavior**: Queries must optionally join with ScheduledTrips to provide complete data to clients.

**Two approaches**:

**Option A - Return joined structure (recommended for new queries)**:
```typescript
export const getActiveTripsWithSchedule = query({
  args: {},
  returns: v.array(v.object({
    vesselTrip: vesselTripSchema,
    scheduledTrip: v.union(scheduledTripSchema, v.null()),
  })),
  handler: async (ctx) => {
    const trips = await ctx.db.query("activeVesselTrips").collect();

    // Batch fetch all scheduled trips by ID
    const scheduledTripIds = trips
      .map(t => t.scheduledTripId)
      .filter((id): id is Id<"scheduledTrips"> => id !== undefined);

    const scheduledTripsMap = new Map<Id<"scheduledTrips">, Doc<"scheduledTrips">>();
    await Promise.all(
      scheduledTripIds.map(async (id) => {
        const trip = await ctx.db.get("scheduledTrips", id);
        if (trip) scheduledTripsMap.set(id, trip);
      })
    );

    // Join and return
    return trips.map(trip => ({
      vesselTrip: stripConvexMeta(trip),
      scheduledTrip: trip.scheduledTripId
        ? stripConvexMeta(scheduledTripsMap.get(trip.scheduledTripId)!)
        : null,
    }));
  },
});
```

**Option B - Keep existing signature, do backend join**:
```typescript
// Keep getActiveTrips signature same, but do join internally
export const getActiveTrips = query({
  args: {},
  returns: v.array(v.object({
    // All vesselTrip fields EXCEPT scheduledTripId
    // PLUS all ScheduledTrip fields (flattened)
  })),
  handler: async (ctx) => {
    // Query vessel trips, fetch scheduled trips by ID, merge into return structure
    // This maintains backward compatibility with existing clients
  },
});
```

**Recommendation**: Create new query functions with joined structure (`getActiveTripsWithSchedule`, `getCompletedTripsWithSchedule`). Keep old functions temporarily for backward compatibility, then deprecate.

#### 4. Mutation Functions
**File**: `convex/functions/vesselTrips/mutations.ts` (check for existence)

**Changes**:
- Update all mutations that accept `VesselTrip` to expect `scheduledTripId` instead of `ScheduledTrip`
- Update `upsertActiveTrip`, `upsertVesselTripsBatch`, `completeAndStartNewTrip` as needed

**Note**: If mutations currently extract fields from `ScheduledTrip` (e.g., `RouteID`, `RouteAbbrev`), these will need to be passed separately or fetched by ID within the mutation.

#### 5. Utility Functions
**File**: `convex/functions/vesselTrips/updates/utils.ts`

**Changes**:
- `tripsAreEqual`: No changes needed (compares `existingTrip` vs `proposedTrip`; field type changes automatically)
- `deepEqual`: Already handles nested objects generically; no changes needed

#### 6. Type Conversions
**File**: `convex/functions/vesselTrips/schemas.ts`

**Changes**:

**toDomainVesselTrip** (line 202):
```typescript
// CURRENT (lines 204-207)
const domainTrip = {
  ...trip,
  ScheduledTrip: trip.ScheduledTrip
    ? toDomainScheduledTrip(trip.ScheduledTrip)
    : undefined,
  // ... other conversions
};

// NEW (proposed)
const domainTrip = {
  ...trip,
  scheduledTripId: trip.scheduledTripId,
  // Remove ScheduledTrip conversion
  // ... other conversions
};
```

**toConvexVesselTrip** (line 148):
```typescript
// CURRENT (line 171)
ScheduledTrip: undefined,

// NEW (proposed)
scheduledTripId: undefined,
```

---

## Implementation Strategy

### Phase 1: Schema and Core Types (High Priority)

1. **Update schema** in `convex/functions/vesselTrips/schemas.ts`
   - Replace `ScheduledTrip: v.optional(scheduledTripSchema)` with `scheduledTripId: v.optional(v.id("scheduledTrips"))`
   - Run `bun run convex:typecheck` to verify type generation

2. **Update type conversions** in same file
   - Modify `toDomainVesselTrip` to handle ref
   - Modify `toConvexVesselTrip` to accept ref

### Phase 2: Build Functions (High Priority)

3. **Update schedule lookups** in `convex/functions/vesselTrips/updates/buildTripWithSchedule.ts`
   - `buildTripWithInitialSchedule`: Return ID instead of full object
   - `buildTripWithFinalSchedule`: Return ID instead of full object

4. **Verify build pipeline** in `convex/functions/vesselTrips/updates/buildTripWithAllData.ts`
   - Should work unchanged (orchestrates build functions)
   - May need to handle ID vs object in downstream logic

### Phase 3: Queries (Medium Priority)

5. **Create new join queries** in `convex/functions/vesselTrips/queries.ts`
   - `getActiveTripsWithSchedule`: Active trips with joined ScheduledTrips
   - `getCompletedTripsWithSchedule`: Completed trips with joined ScheduledTrips

6. **Update existing queries** (or deprecate)
   - Decide: keep old signature with backend join OR create new functions
   - Document deprecation plan

### Phase 4: Mutations (Medium Priority)

7. **Update mutations** in `convex/functions/vesselTrips/mutations.ts`
   - Check for references to `trip.ScheduledTrip`
   - Update to use `trip.scheduledTripId` or fetch by ID

### Phase 5: Client Integration (Low Priority - Next Agent)

8. **Update client-side queries**
   - Switch to new query functions with joined structure
   - Implement context caching for ScheduledTrips (fetch once per sailing day)

9. **Update frontend types**
   - Update `VesselTrip` domain types
   - Remove `ScheduledTrip` field, add `scheduledTripId`

---

## Testing Strategy

### Unit Tests

1. **Schema validation**: Ensure new schema validates correctly with `v.id("scheduledTrips")`
2. **Type conversions**: Verify `toDomainVesselTrip` and `toConvexVesselTrip` handle refs correctly
3. **Schedule lookups**: Verify `buildTripWithInitialSchedule` and `buildTripWithFinalSchedule` return IDs

### Integration Tests

1. **New trip flow**: `runUpdateVesselTrips` → `buildTripWithAllData` → schedule lookup → mutation
2. **Trip boundary flow**: Complete trip → new trip with scheduled trip ID
3. **Regular update flow**: Existing trip with scheduled trip ID
4. **Query joins**: Verify queries fetch and join ScheduledTrips correctly
5. **Missing references**: Verify queries handle `scheduledTripId: undefined` gracefully

### Regression Tests

1. **ML predictions**: Ensure prediction flow still works (doesn't depend on ScheduledTrip structure)
2. **Prediction records**: Verify extraction and insertion still works
3. **Backfill operations**: Ensure `setDepartNextActualsForMostRecentCompletedTrip` works with refs

---

## Gotchas and Considerations

### 1. Field Extraction from ScheduledTrip

If any code currently extracts fields from `trip.ScheduledTrip` (e.g., `RouteID`, `RouteAbbrev`), this will break with refs. Options:

- **Option A**: Extract fields during schedule lookup, store as separate fields in VesselTrip (partial denormalization for key fields)
- **Option B**: Fetch by ID wherever needed (relies on caching)
- **Option C**: Backend queries join and return merged structure

**Check locations**:
- `buildTripFromVesselLocation.ts` - Does it use ScheduledTrip fields?
- `buildCompletedTrip.ts` - Does it use ScheduledTrip fields?
- ML prediction functions - Do they need Schedule fields?

### 2. Existing Data Migration

When schema changes from `ScheduledTrip` (object) to `scheduledTripId` (ref), existing documents will have:

```typescript
{
  // Old format
  ScheduledTrip: { VesselAbbrev: "...", Key: "...", ... },
  // Missing scheduledTripId
}
```

**Migration options**:

1. **Write migration script**: One-time action to convert existing documents
2. **Backward compatibility**: Accept both formats during transition period
3. **Natural migration**: Overwrite on next vessel update (active trips only; completed trips need migration)

**Recommendation**: Write migration script for completed trips; let active trips overwrite naturally.

### 3. Client-Side Context Caching

After backend refactoring, implement client-side caching:

```typescript
// Context that fetches ScheduledTrips once per sailing day
const ScheduledTripsContext = createContext<Map<Id<"scheduledTrips">, ScheduledTrip> | null>(null);

// Provider fetches and caches
export const ScheduledTripsProvider = ({ children, sailingDay }) => {
  const { data: scheduledTrips } = useQuery(
    api.functions.scheduledTrips.getScheduledTripsForSailingDay,
    { sailingDay }
  );

  const tripsMap = useMemo(() => {
    if (!scheduledTrips) return null;
    return new Map(scheduledTrips.map(st => [st._id, toDomainScheduledTrip(st)]));
  }, [scheduledTrips]);

  return (
    <ScheduledTripsContext.Provider value={tripsMap}>
      {children}
    </ScheduledTripsContext.Provider>
  );
};

// Components use context to resolve refs
export const useScheduledTrip = (tripId?: Id<"scheduledTrips">) => {
  const tripsMap = useContext(ScheduledTripsContext);
  return tripId && tripsMap ? tripsMap.get(tripId) : null;
};
```

### 4. Convex Function Registration

Per [convex_rules.mdc](docs/convex_rules.mdc) (lines 102-106):

- Use `query`, `mutation`, `action` for public functions
- Use `internalQuery`, `internalMutation`, `internalAction` for private functions
- ALWAYS include argument and return validators

Ensure new query functions follow these guidelines.

### 5. Type Safety

Use `Id<"scheduledTrips">` type for strict type checking. Import from `convex/_generated/dataModel`:

```typescript
import { Id } from "_generated/dataModel";

const scheduledTripId: Id<"scheduledTrips"> | undefined = trip.scheduledTripId;
```

See [convex_rules.mdc](docs/convex_rules.mdc) (line 189) for TypeScript guidelines.

---

## Deliverables for Next Agent

### Primary Tasks

1. ✅ Update `vesselTripSchema` in `convex/functions/vesselTrips/schemas.ts`
   - Replace `ScheduledTrip: v.optional(scheduledTripSchema)` with `scheduledTripId: v.optional(v.id("scheduledTrips"))`
   - Update type conversions (`toDomainVesselTrip`, `toConvexVesselTrip`)
   - Run `bun run convex:typecheck`

2. ✅ Update `buildTripWithSchedule.ts`
   - Modify `buildTripWithInitialSchedule` to return ID
   - Modify `buildTripWithFinalSchedule` to return ID
   - Ensure `ArrivingTerminalAbbrev` is still extracted before returning

3. ✅ Create join queries in `vesselTrips/queries.ts`
   - `getActiveTripsWithSchedule` with batched ScheduledTrip fetching
   - `getCompletedTripsWithSchedule` with batched ScheduledTrip fetching
   - Follow Convex guidelines for validators (convex_rules.mdc lines 75-87)

4. ✅ Verify mutations work with new schema
   - Check `convex/functions/vesselTrips/mutations.ts`
   - Update any code that accesses `trip.ScheduledTrip`

### Secondary Tasks

5. ⚠️ Write migration script for existing completed trips
6. ⚠️ Update client-side queries to use new join functions
7. ⚠️ Implement ScheduledTrips context caching

---

## References

### Code References

- **Schema definition**: `convex/functions/vesselTrips/schemas.ts` (line 100)
- **Scheduled trip schema**: `convex/functions/scheduledTrips/schemas.ts` (line 23)
- **Schedule lookups**: `convex/functions/vesselTrips/updates/buildTripWithSchedule.ts` (lines 27-108)
- **Current queries**: `convex/functions/vesselTrips/queries.ts` (lines 14-81)
- **Update orchestrator**: `convex/functions/vesselTrips/updates/updateVesselTrips.ts` (lines 44-87)

### Documentation References

- **Convex rules**: `docs/convex_rules.mdc` - Function guidelines, validators, TypeScript types
- **Update architecture**: `convex/functions/vesselTrips/updates/README.md` - Pipeline overview, event types
- **Convex Document IDs**: https://docs.convex.dev/database/document-ids.md - Reference pattern

### Key Guidelines from convex_rules.mdc

- **New function syntax** (lines 9-20): Always use `query({ args, returns, handler })` format
- **Validators** (lines 39-87): Use `v.id("tableName")` for ID types, `v.null()` for nullable returns
- **Function registration** (lines 102-106): Use public/private function decorators appropriately
- **TypeScript** (lines 188-214): Use `Id<"tableName">` types, strict typing with IDs

---

## Success Criteria

✅ Schema updated to use `v.id("scheduledTrips")` for refs
✅ Type conversions handle IDs correctly
✅ Schedule lookup functions return IDs instead of full objects
✅ New join queries fetch and merge ScheduledTrips
✅ All existing functionality preserved (ML predictions, trip updates, backfills)
✅ Type checking passes (`bun run convex:typecheck`)
✅ Migration path for existing data documented/implemented

---

## Questions for Next Agent

1. Are there any places in the codebase that extract fields from `trip.ScheduledTrip` (e.g., `RouteID`, `RouteAbbrev`) that we need to account for?
2. Should we preserve backward compatibility by keeping old query signatures temporarily, or break immediately?
3. What's the preferred approach for migrating existing completed trip data in the database?
4. Should we partially denormalize key ScheduledTrip fields (RouteID, RouteAbbrev, Key) back into VesselTrip for common queries?
