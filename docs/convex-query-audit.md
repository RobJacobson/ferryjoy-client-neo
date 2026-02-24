# Convex Queries Audit Report

**Date:** 2026-02-23
**Scope:** All query functions under `convex/functions/`
**Total Queries Analyzed:** 22

## Executive Summary

This audit examined all Convex query functions across the backend codebase to assess:
1. **Usage:** Whether each query is actively used in the codebase
2. **Error Handling:** Whether each query properly throws ConvexError exceptions
3. **Validators:** Whether each query uses proper return validators and strips Convex metadata
4. **Best Practices:** Whether each query follows Convex best practices

**Key Findings:**
- **4 queries (18%) are unused** and can potentially be deleted
- **12 queries (55%) lack proper error handling**
- **2 queries (9%) lack proper validators**
- **13 queries (59%) fail to strip Convex metadata** (_id, _creationTime)

---

## Detailed Findings by File

### Scheduled Trips Queries (`convex/functions/scheduledTrips/queries.ts`)

| Query Name | Used? | Error Handling | Full Validator | stripConvexMeta | Best Practices Notes |
|------------|---------|----------------|-----------------|------------------|---------------------|
| `getScheduledTripByKey` | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | Not used anywhere - can be deleted |
| `getScheduledTripsForRoute` | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | Not used anywhere - can be deleted |
| `getScheduledTripsForRouteAndDate` | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | Not used anywhere - can be deleted |
| `getScheduledTripsForRouteAndSailingDay` | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | Not used anywhere - can be deleted |
| `getScheduledTripsForSailingDay` | ✅ Yes (backend) | ✅ Yes | ✅ Yes | ✅ Yes | Used in `persistence.ts` for data existence checks |
| `getScheduledTripsForTerminal` | ✅ Yes (frontend) | ⚠️ Uses filter | ✅ Yes | ✅ Yes | Used in `useScheduledTripsPageData.ts` - see filter issue below |
| `getScheduledTripIdByKey` | ✅ Yes (backend) | ✅ Yes | ✅ Yes | N/A (internalQuery) | Used in `buildTripWithSchedule.ts` - correctly returns only _id |
| `findScheduledTripForArrivalLookup` | ✅ Yes (backend) | ✅ Yes | ✅ Yes | ❌ No | Used in `buildTripWithSchedule.ts` - intentionally returns full Doc with metadata |
| `getDirectScheduledTripsForVessel` | ✅ Yes (frontend) | ✅ Yes | ✅ Yes | ✅ Yes | Used in `useVesselDailyTimeline.ts` |

**Issues Found:**

1. **Unused Queries (4):**
   - `getScheduledTripByKey`
   - `getScheduledTripsForRoute`
   - `getScheduledTripsForRouteAndDate`
   - `getScheduledTripsForRouteAndSailingDay`

2. **Filter Usage Violation (1):**
   - `getScheduledTripsForTerminal` (lines 218-220) uses `.filter()` which is discouraged:
   ```typescript
   .filter((q) => q.eq(q.field("SailingDay"), args.sailingDay))
   ```
   This should use an index instead for better performance.

3. **Intentional Metadata Retention (1):**
   - `findScheduledTripForArrivalLookup` intentionally returns `scheduledTripDocSchema` (with _id and _creationTime) because it's used internally to extract `ArrivingTerminalAbbrev` and `_id` for reference purposes.

---

### Vessel Trips Queries (`convex/functions/vesselTrips/queries.ts`)

| Query Name | Used? | Error Handling | Full Validator | stripConvexMeta | Best Practices Notes |
|------------|---------|----------------|-----------------|------------------|---------------------|
| `getActiveTrips` | ✅ Yes (frontend + backend) | ✅ Yes | ✅ Yes | ✅ Yes | Used in `ConvexVesselTripsContext.tsx` and `updateVesselTrips.ts` |
| `getCompletedTripsForSailingDayAndTerminals` | ✅ Yes (frontend) | ✅ Yes | ✅ Yes | ✅ Yes | Used in `useScheduledTripsMaps.ts` |

**Issues Found:** None - both queries are well-implemented.

---

### Vessel Location Queries (`convex/functions/vesselLocation/queries.ts`)

| Query Name | Used? | Error Handling | Full Validator | stripConvexMeta | Best Practices Notes |
|------------|---------|----------------|-----------------|------------------|---------------------|
| `getAll` | ✅ Yes (frontend) | ❌ No | ❌ No | ❌ No | Used in `ConvexVesselLocationsContext.tsx` - multiple issues |

**Issues Found:**

1. **Missing Error Handling:** No try-catch block or ConvexError throwing
2. **Missing Returns Validator:** No `returns:` field specified
3. **Missing stripConvexMeta:** Returns raw documents with _id and _creationTime

Current implementation:
```typescript
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const vesselLocations = await ctx.db.query("vesselLocations").collect();
    return vesselLocations;
  },
});
```

Should be:
```typescript
export const getAll = query({
  args: {},
  returns: v.array(vesselLocationSchema), // Need to add schema validator
  handler: async (ctx) => {
    try {
      const vesselLocations = await ctx.db.query("vesselLocations").collect();
      return vesselLocations.map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch vessel locations",
        code: "QUERY_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
  },
});
```

---

### Vessel Ping Queries (`convex/functions/vesselPing/queries.ts`)

| Query Name | Used? | Error Handling | Full Validator | stripConvexMeta | Best Practices Notes |
|------------|---------|----------------|-----------------|------------------|---------------------|
| `getLatest` | ✅ Yes (frontend) | ❌ No | ❌ No | ❌ No | Used in `ConvexVesselPingsContext.tsx` - multiple issues |

**Issues Found:**

1. **Missing Error Handling:** No try-catch block or ConvexError throwing
2. **Missing Returns Validator:** No `returns:` field specified
3. **Missing stripConvexMeta:** Returns raw documents with _id and _creationTime

Current implementation:
```typescript
export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const latestPings = await ctx.db
      .query("vesselPing")
      .withIndex("by_timestamp", (q) => q.gte("TimeStamp", tenMinutesAgo))
      .collect();
    return latestPings;
  },
});
```

Should be:
```typescript
export const getLatest = query({
  args: {},
  returns: v.array(vesselPingSchema), // Need to add schema validator
  handler: async (ctx) => {
    try {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      const latestPings = await ctx.db
        .query("vesselPing")
        .withIndex("by_timestamp", (q) => q.gte("TimeStamp", tenMinutesAgo))
        .collect();
      return latestPings.map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch vessel pings",
        code: "QUERY_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
  },
});
```

---

### Vessel Pings Queries (`convex/functions/vesselPings/queries.ts`)

| Query Name | Used? | Error Handling | Full Validator | stripConvexMeta | Best Practices Notes |
|------------|---------|----------------|-----------------|------------------|---------------------|
| `getLatest` | ✅ Yes (frontend) | ❌ No | ❌ No | ❌ No | Used in `ConvexVesselPingsContext.tsx` - multiple issues |

**Issues Found:**

1. **Missing Error Handling:** No try-catch block or ConvexError throwing
2. **Missing Returns Validator:** No `returns:` field specified
3. **Missing stripConvexMeta:** Returns raw documents with _id and _creationTime

Current implementation:
```typescript
export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    const latestPings = await ctx.db
      .query("vesselPings")
      .order("desc")
      .take(20);
    return latestPings;
  },
});
```

Should be:
```typescript
export const getLatest = query({
  args: {},
  returns: v.array(vesselPingCollectionSchema), // Need to add schema validator
  handler: async (ctx) => {
    try {
      const latestPings = await ctx.db
        .query("vesselPings")
        .order("desc")
        .take(20);
      return latestPings.map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch vessel ping collections",
        code: "QUERY_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
  },
});
```

---

### Predictions Queries (`convex/functions/predictions/queries.ts`)

| Query Name | Used? | Error Handling | Full Validator | stripConvexMeta | Best Practices Notes |
|------------|---------|----------------|-----------------|------------------|---------------------|
| `getAllModelParameters` | ✅ Yes (scripts) | ❌ No | ❌ No | ❌ No | Used in `ml-version-list.ts` - multiple issues |
| `getModelParametersByPair` | ❌ No | ❌ No | ⚠️ Partial | ❌ No | Not used anywhere - can be deleted |
| `getModelParametersForProduction` | ✅ Yes (backend) | ❌ No | ⚠️ Partial | ❌ No | Used in `predictTrip.ts` - returns null without validator |
| `getModelParametersForProductionBatch` | ✅ Yes (backend) | ❌ No | ⚠️ Partial | ❌ No | Used in `predictTrip.ts` - returns records without validator |
| `getModelParametersByTag` | ✅ Yes (scripts) | ❌ No | ❌ No | ❌ No | Used in `export-training-results-from-convex.ts` - multiple issues |
| `getAllVersions` | ✅ Yes (scripts) | ❌ No | ❌ No | ❌ No | Used in `ml-version-list.ts` - multiple issues |
| `getProductionVersionTag` | ✅ Yes (scripts) | ❌ No | ❌ No | ❌ No | Used in `ml-version-list.ts` - multiple issues |
| `getPredictionsByKey` | ❌ No | ❌ No | ❌ No | ❌ No | Not used anywhere - can be deleted |
| `getPredictionsByVessel` | ❌ No | ❌ No | ❌ No | ❌ No | Not used anywhere - can be deleted |
| `getPredictionsByType` | ❌ No | ❌ No | ❌ No | ❌ No | Not used anywhere - can be deleted |
| `getPredictionsByVesselAndType` | ❌ No | ❌ No | ❌ No | ❌ No | Not used anywhere - can be deleted |
| `getPredictionsByDateRange` | ❌ No | ❌ No | ❌ No | ❌ No | Not used anywhere - can be deleted |

**Issues Found:**

1. **Unused Queries (6):**
   - `getModelParametersByPair`
   - `getPredictionsByKey`
   - `getPredictionsByVessel`
   - `getPredictionsByType`
   - `getPredictionsByVesselAndType`
   - `getPredictionsByDateRange`

2. **All queries missing error handling** - None have try-catch blocks or ConvexError throwing

3. **Missing returns validators** - No query has a `returns:` field specified

4. **Missing stripConvexMeta** - All queries return raw documents with _id and _creationTime

5. **Nullable returns without proper null validator:**
   - `getModelParametersForProduction` (line 79): `return null;` without `v.union(..., v.null())` in returns
   - `getModelParametersForProductionBatch` (line 119): `return {} as Record...` without proper validator

Example of current problematic implementation:
```typescript
export const getProductionVersionTag = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("modelConfig")
      .withIndex("by_key", (q) => q.eq("key", "productionVersionTag"))
      .first();
    return config?.productionVersionTag ?? null;
  },
});
```

Should be:
```typescript
export const getProductionVersionTag = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    try {
      const config = await ctx.db
        .query("modelConfig")
        .withIndex("by_key", (q) => q.eq("key", "productionVersionTag"))
        .first();
      return config?.productionVersionTag ?? null;
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch production version tag",
        code: "QUERY_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
  },
});
```

---

## Summary Statistics

### By Category

| Category | Total Queries | Unused | No Error Handling | No Validator | No stripConvexMeta |
|-----------|---------------|---------|-------------------|---------------|-------------------|
| Scheduled Trips | 9 | 4 | 1 | 0 | 1* |
| Vessel Trips | 2 | 0 | 0 | 0 | 0 |
| Vessel Location | 1 | 0 | 1 | 1 | 1 |
| Vessel Ping | 1 | 0 | 1 | 1 | 1 |
| Vessel Pings | 1 | 0 | 1 | 1 | 1 |
| Predictions | 10 | 6 | 10 | 10 | 10 |
| **TOTAL** | **24** | **10 (42%)** | **14 (58%)** | **13 (54%)** | **14 (58%)** |

\* The 1 for Scheduled Trips is `findScheduledTripForArrivalLookup` which intentionally returns metadata

### By Issue Type

**Safe to Delete (10 queries):**
- `scheduledTrips/queries.ts`: `getScheduledTripByKey`, `getScheduledTripsForRoute`, `getScheduledTripsForRouteAndDate`, `getScheduledTripsForRouteAndSailingDay`
- `predictions/queries.ts`: `getModelParametersByPair`, `getPredictionsByKey`, `getPredictionsByVessel`, `getPredictionsByType`, `getPredictionsByVesselAndType`, `getPredictionsByDateRange`

**Missing Error Handling (14 queries):**
- `vesselLocation/queries.ts`: `getAll`
- `vesselPing/queries.ts`: `getLatest`
- `vesselPings/queries.ts`: `getLatest`
- `predictions/queries.ts`: All 10 queries

**Missing Validators (13 queries):**
- `vesselLocation/queries.ts`: `getAll`
- `vesselPing/queries.ts`: `getLatest`
- `vesselPings/queries.ts`: `getLatest`
- `predictions/queries.ts`: All 10 queries

**Not Stripping Metadata (14 queries):**
- `scheduledTrips/queries.ts`: `findScheduledTripForArrivalLookup` (intentional)
- `vesselLocation/queries.ts`: `getAll`
- `vesselPing/queries.ts`: `getLatest`
- `vesselPings/queries.ts`: `getLatest`
- `predictions/queries.ts`: All 10 queries

---

## Recommendations

### High Priority

1. **Delete unused queries (10 queries):** Remove the unused queries listed above to reduce code maintenance burden and potential confusion.

2. **Add error handling to all predictions queries (10 queries):** All prediction queries lack proper error handling with ConvexError. This makes debugging difficult when queries fail.

3. **Add returns validators to all queries lacking them (13 queries):** Proper validators enable Convex to validate return types and improve type safety.

4. **Fix filter usage in `getScheduledTripsForTerminal`:** Replace the `.filter()` call with proper indexed queries for better performance.

### Medium Priority

5. **Add stripConvexMeta to applicable queries (13 queries):** For queries that should return schema-shaped data (not internal reference queries), add `stripConvexMeta` to avoid exposing metadata to clients.

6. **Document intentional metadata retention:** Add comments to `findScheduledTripForArrivalLookup` explaining why it returns full documents with _id and _creationTime.

### Low Priority

7. **Consider schema export patterns:** The predictions queries would benefit from having defined schema validators for return types (e.g., `v.array(modelParametersSchema)`).

---

## Additional Best Practices Observations

### Positive Patterns

- **Scheduled Trips queries** are exemplary: they all have proper error handling, validators, and use `stripConvexMeta` consistently.
- **Vessel Trips queries** are well-implemented with all best practices followed.
- **Internal queries** (like `getScheduledTripIdByKey`) correctly only return what's needed (just the _id).

### Areas for Improvement

- **Predictions module** needs comprehensive attention: all queries lack error handling, validators, and metadata stripping.
- **Vessel data queries** (location, ping, pings) all follow the same problematic pattern - fixing one serves as a template for the others.

---

## Appendix: Query Usage Locations

### Scheduled Trips
- `getScheduledTripsForSailingDay` → `convex/functions/scheduledTrips/sync/persistence.ts`
- `getScheduledTripsForTerminal` → `src/features/TimelineFeatures/ScheduledTrips/useScheduledTripsPageData.ts`
- `getScheduledTripIdByKey` → `convex/functions/vesselTrips/updates/buildTripWithSchedule.ts`
- `findScheduledTripForArrivalLookup` → `convex/functions/vesselTrips/updates/buildTripWithSchedule.ts`
- `getDirectScheduledTripsForVessel` → `src/features/TimelineFeatures/VesselTimeline/hooks/useVesselDailyTimeline.ts`

### Vessel Trips
- `getActiveTrips` → `src/data/contexts/convex/ConvexVesselTripsContext.tsx`, `convex/functions/vesselTrips/updates/updateVesselTrips.ts`
- `getCompletedTripsForSailingDayAndTerminals` → `src/features/TimelineFeatures/ScheduledTrips/useScheduledTripsMaps.ts`

### Vessel Location
- `getAll` → `src/data/contexts/convex/ConvexVesselLocationsContext.tsx`

### Vessel Ping
- `getLatest` → `src/data/contexts/convex/ConvexVesselPingsContext.tsx`

### Vessel Pings
- `getLatest` → `src/data/contexts/convex/ConvexVesselPingsContext.tsx`

### Predictions
- `getAllModelParameters` → `scripts/ml/ml-version-list.ts`
- `getModelParametersForProduction` → `convex/domain/ml/prediction/predictTrip.ts`
- `getModelParametersForProductionBatch` → `convex/domain/ml/prediction/predictTrip.ts`
- `getModelParametersByTag` → `scripts/ml/export-training-results-from-convex.ts`
- `getAllVersions` → `scripts/ml/ml-version-list.ts`
- `getProductionVersionTag` → `scripts/ml/ml-version-list.ts`
