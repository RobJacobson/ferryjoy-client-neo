# Zod 4 Codec Schema Refactoring Documentation

## Overview

This document explains the refactoring of our Convex schemas to use **Zod 4 with `z.codec`** as the single source of truth. This change eliminates schema duplication, automates Date/number transformations, and provides better type safety throughout the codebase.

## Table of Contents

1. [Background: The Problem We Solved](#background-the-problem-we-solved)
2. [Previous Architecture](#previous-architecture)
3. [New Architecture with Zod Codecs](#new-architecture-with-zod-codecs)
4. [How Zod Codecs Work](#how-zod-codecs-work)
5. [Integration with Convex](#integration-with-convex)
6. [Migration Details](#migration-details)
7. [Benefits and Improvements](#benefits-and-improvements)
8. [References and Sources](#references-and-sources)

---

## Background: The Problem We Solved

### The Core Issue

Our application works with **two different data representations**:

1. **Domain Layer** (`src/domain/`): Uses JavaScript `Date` objects for timestamps
2. **Convex Storage Layer** (`convex/`): Stores timestamps as `number` (milliseconds since epoch)

This mismatch required manual conversion functions scattered throughout the codebase, leading to:

- **Schema duplication**: `completedVesselTripSchema` used `...activeVesselTripSchema.fields` (field spreading)
- **Manual conversions**: Separate `toConvex*` and `toDomain*` functions for each entity
- **Type redundancy**: Convex types manually defined (20-30+ lines per schema), domain types via `ReturnType<typeof toDomainFunction>`
- **Maintenance burden**: Easy to miss fields during refactoring, no single source of truth

### Example of the Problem

**Before refactoring:**
```typescript
// Convex schema (numbers)
export const activeVesselTripSchema = v.object({
  TimeStamp: v.number(),
  ScheduledDeparture: v.optional(v.number()),
  // ... 20+ more fields
});

// Manual conversion function
export const toDomainActiveVesselTrip = (trip: ConvexActiveVesselTrip) => ({
  ...trip,
  TimeStamp: new Date(trip.TimeStamp),  // Manual conversion
  ScheduledDeparture: trip.ScheduledDeparture ? new Date(trip.ScheduledDeparture) : undefined,
  // ... manually convert every date field
});

// Schema overlap issue
export const completedVesselTripSchema = v.object({
  ...activeVesselTripSchema.fields,  // ❌ Field spreading - no single source of truth
  // Additional fields
});
```

---

## Previous Architecture

### Schema Definition Pattern

**Location**: `convex/functions/*/schemas.ts`

Schemas were defined using Convex's native `v` validators:

```typescript
import { v } from "convex/values";

export const vesselLocationValidationSchema = v.object({
  VesselID: v.number(),
  TimeStamp: v.number(),  // Stored as number
  LeftDock: v.optional(v.number()),
  Eta: v.optional(v.number()),
  // ... other fields
});

export type ConvexVesselLocation = Infer<typeof vesselLocationValidationSchema>;
```

### Conversion Functions

**Two-way conversion was manual:**

1. **To Convex** (`toConvex*` functions): Convert domain objects (with `Date`) → Convex format (with `number`)
   ```typescript
   export const toConvexVesselLocation = (vl: DottieVesselLocation) => ({
     // ... other fields
     LeftDock: vl.LeftDock?.getTime(),  // Date → number
     Eta: vl.Eta?.getTime(),
     TimeStamp: vl.TimeStamp.getTime(),
   });
   ```

2. **To Domain** (`toDomain*` functions): Convert Convex format (with `number`) → domain objects (with `Date`)
   ```typescript
   export const toDomainVesselLocation = (location: ConvexVesselLocation) => ({
     ...location,
     LeftDock: toDateOrUndefined(location.LeftDock),  // number → Date
     Eta: toDateOrUndefined(location.Eta),
     TimeStamp: new Date(location.TimeStamp),
   });
   ```

### Schema Overlap Problem

The most problematic pattern was field spreading:

```typescript
// convex/functions/completedVesselTrips/schemas.ts
export const completedVesselTripSchema = v.object({
  ...activeVesselTripSchema.fields,  // ❌ No single source of truth
  // Extended fields
  Key: v.string(),
  TripEnd: v.number(),
  // ...
});
```

**Issues:**
- Fields must be manually kept in sync
- No compile-time guarantee of consistency
- Refactoring requires updating multiple places
- Type inference doesn't properly extend

---

## New Architecture with Zod Codecs

### Core Concept

**Zod 4's `z.codec`** provides **bidirectional transformations** between two data representations:

- **Input schema**: The format stored in Convex (numbers)
- **Output schema**: The format used in our domain layer (Date objects)
- **Transform functions**: `decode` (number → Date) and `encode` (Date → number)

### Shared Date Codec

**Location**: `convex/shared/codecs.ts`

```typescript
import { z } from "zod";

/**
 * Codec for converting between epoch milliseconds (number) and Date objects
 * 
 * - decode: Converts from Convex storage format (number) to domain format (Date)
 * - encode: Converts from domain format (Date) to Convex storage format (number)
 */
export const epochMillisToDate = z.codec(
  z.number(),  // Input schema: number (Convex storage format)
  z.date(),    // Output schema: Date (domain format)
  {
    decode: (num) => new Date(num),     // number → Date
    encode: (date) => date.getTime(),   // Date → number
  }
);

// Optional variant for optional date fields
export const optionalEpochMillisToDate = epochMillisToDate.optional();
```

### Schema Definition with Codecs

**Location**: `convex/functions/vesselLocation/schemas.ts`

```typescript
import { z } from "zod";
import { zodToConvex } from "convex-helpers/server/zod";
import { epochMillisToDate, optionalEpochMillisToDate } from "../../shared/codecs";

/**
 * Zod schema for vessel location (domain representation with Date objects)
 * This is the SINGLE SOURCE OF TRUTH
 */
export const vesselLocationSchema = z.object({
  VesselID: z.number(),
  TimeStamp: epochMillisToDate,  // ✅ Automatic Date ↔ number transformation
  LeftDock: optionalEpochMillisToDate,
  Eta: optionalEpochMillisToDate,
  ScheduledDeparture: optionalEpochMillisToDate,
  // ... other fields
});

/**
 * Convex validator (converted from Zod schema)
 * Used in defineTable and function argument validation
 */
export const vesselLocationValidationSchema = zodToConvex(vesselLocationSchema);

/**
 * Domain type (with Date objects) - inferred from Zod schema
 */
export type VesselLocation = z.infer<typeof vesselLocationSchema>;

/**
 * Convex type (with numbers) - inferred from Convex validator
 * Single source of truth - no manual type definition needed!
 */
import type { Infer } from "convex/values";
export type ConvexVesselLocation = Infer<typeof vesselLocationValidationSchema>;
```

### Type Inference from Validators

**Key Improvement**: Convex types are now inferred from validators, eliminating manual type definitions.

**Before** (manual type definition - 20-30+ lines):
```typescript
export type ConvexVesselLocation = {
  VesselID: number;
  VesselName?: string;
  DepartingTerminalID: number;
  // ... 20+ more fields manually defined
  TimeStamp: number;
};
```

**After** (inferred from validator - 1 line):
```typescript
import type { Infer } from "convex/values";
export type ConvexVesselLocation = Infer<typeof vesselLocationValidationSchema>;
```

**Benefits:**
- ✅ **Single source of truth**: Type comes directly from the validator
- ✅ **Automatic synchronization**: Schema changes automatically update types
- ✅ **No duplication**: Eliminates 150+ lines of manual type definitions
- ✅ **Type safety**: Types always match what the validator expects

**How it works:**
1. Zod schema defines the structure (with codecs for Date fields)
2. `zodToConvex()` converts it to a Convex validator
3. `Infer<typeof validator>` extracts the type that the validator validates
4. Since validators validate the encoded format (numbers), the inferred type has numbers

### Schema Extension (No More Field Spreading!)

**Location**: `convex/functions/completedVesselTrips/schemas.ts`

**Before:**
```typescript
export const completedVesselTripSchema = v.object({
  ...activeVesselTripSchema.fields,  // ❌ Field spreading
  Key: v.string(),
  TripEnd: v.number(),
});
```

**After:**
```typescript
import { activeVesselTripZodSchema } from "../activeVesselTrips/schemas";

/**
 * Extends activeVesselTripSchema using Zod's .extend()
 * ✅ Single source of truth - no field duplication!
 */
export const completedVesselTripZodSchema = activeVesselTripZodSchema.extend({
  Key: z.string(),
  TripEnd: epochMillisToDate,
  // Override: make LeftDockActual required in completed trips
  LeftDockActual: epochMillisToDate,
  AtDockDuration: z.number(),
  AtSeaDuration: z.number(),
  TotalDuration: z.number(),
});

export const completedVesselTripSchema = zodToConvex(completedVesselTripZodSchema);
```

**Benefits:**
- ✅ Type-safe extension
- ✅ Compile-time guarantees
- ✅ Single source of truth
- ✅ Proper type inference

---

## How Zod Codecs Work

### Understanding `z.codec()`

The `z.codec()` function creates a **bidirectional transformer** between two schemas:

```typescript
const codec = z.codec(
  inputSchema,   // Schema for the input type (what you encode FROM)
  outputSchema,  // Schema for the output type (what you decode TO)
  {
    decode: (input) => output,  // Transform input → output
    encode: (output) => input,   // Transform output → input
  }
);
```

### Our Date Codec in Detail

```typescript
export const epochMillisToDate = z.codec(
  z.number(),  // Input: number (what Convex stores)
  z.date(),    // Output: Date (what our domain uses)
  {
    decode: (num) => new Date(num),     // When reading from Convex
    encode: (date) => date.getTime(),   // When writing to Convex
  }
);
```

### Using Codecs in Schemas

When you use a codec in a Zod schema:

```typescript
const schema = z.object({
  timestamp: epochMillisToDate,
});

// Decode: Convex format (number) → Domain format (Date)
const domain = schema.decode({ timestamp: 1234567890 });
// Result: { timestamp: Date(1234567890) }

// Encode: Domain format (Date) → Convex format (number)
const convex = schema.encode({ timestamp: new Date() });
// Result: { timestamp: 1640995200000 }
```

### Codec Composition

Codecs can be composed and used in nested structures:

```typescript
const vesselPingSchema = z.object({
  VesselID: z.number(),
  TimeStamp: epochMillisToDate,  // Codec in object
});

const collectionSchema = z.object({
  timestamp: epochMillisToDate,  // Codec in object
  pings: z.array(vesselPingSchema),  // Nested schema with codec
});

// Both encode/decode work recursively
const encoded = collectionSchema.encode({
  timestamp: new Date(),
  pings: [{ VesselID: 1, TimeStamp: new Date() }],
});
// All Dates are automatically converted to numbers
```

### Important Codec Behaviors

1. **`.parse()` vs `.decode()`**: 
   - `.parse()` accepts `unknown` and validates
   - `.decode()` expects strongly-typed input (TypeScript error if wrong type)
   - At runtime, they're equivalent: `.parse()` calls `.decode()` internally

2. **Refinements work in both directions**:
   ```typescript
   const schema = epochMillisToDate.refine(
     (date) => date.getFullYear() > 2000,
     "Must be this millennium"
   );
   
   schema.encode(new Date("1999-01-01"));  // ❌ Validation error
   schema.encode(new Date("2024-01-01"));  // ✅ Passes
   ```

3. **Defaults only apply in decode direction**:
   ```typescript
   const withDefault = z.string().default("hello");
   withDefault.decode(undefined);  // ✅ Returns "hello"
   withDefault.encode(undefined);   // ❌ Error: undefined not valid for encode
   ```

---

## Integration with Convex

### Converting Zod Schemas to Convex Validators

**Library**: `convex-helpers/server/zod`

The `zodToConvex()` function converts Zod schemas (with codecs) into Convex validators:

```typescript
import { zodToConvex } from "convex-helpers/server/zod";

const zodSchema = z.object({
  timestamp: epochMillisToDate,
  name: z.string(),
});

// Convert to Convex validator
const convexValidator = zodToConvex(zodSchema);

// Use in Convex schema definition
export default defineSchema({
  myTable: defineTable(convexValidator),
});
```

### How `zodToConvex` Handles Codecs

When `zodToConvex` encounters a codec:

1. **For table definitions**: Uses the **input schema** (numbers) - this is what Convex stores
2. **For validation**: Validates against the input schema format
3. **Transformations**: The codec's `encode` function is used when data is written to Convex

**Important**: Convex always stores the **encoded format** (numbers), not the decoded format (Dates).

### Using Schemas in Convex Functions

**Function argument validation:**

```typescript
import { vesselLocationSchema } from "./schemas";
import { zodToConvex } from "convex-helpers/server/zod";

export const myMutation = mutation({
  args: {
    location: zodToConvex(vesselLocationSchema),  // Validates as numbers
  },
  handler: async (ctx, args) => {
    // args.location has numbers (Convex format)
    // If you need Dates, decode it:
    const domainLocation = vesselLocationSchema.decode(args.location);
  },
});
```

**Reading from database:**

```typescript
export const myQuery = query({
  handler: async (ctx) => {
    const doc = await ctx.db.get(id);
    // doc has numbers (Convex format)
    
    // Convert to domain format (Dates) if needed:
    const domainDoc = vesselLocationSchema.decode(doc);
    return domainDoc;
  },
});
```

### Domain Layer Conversion

**Location**: `src/domain/vessels/*.ts`

Domain conversion functions now use Zod's `.decode()`:

```typescript
import { vesselLocationSchema } from "../../../convex/functions/vesselLocation/schemas";

/**
 * Convert Convex vessel location (numbers) to domain vessel location (Dates)
 * Uses Zod schema's decode to automatically convert numbers to Dates
 */
export const toDomainVesselLocation = (location: ConvexVesselLocation) =>
  vesselLocationSchema.decode(location);

export type VesselLocation = ReturnType<typeof toDomainVesselLocation>;
```

**Before**: Manual field-by-field conversion
**After**: Single line using Zod decode

---

## Migration Details

### Files Changed

1. **New Files**:
   - `convex/shared/codecs.ts` - Shared date codec definitions

2. **Schema Files Migrated** (6 files):
   - `convex/functions/vesselPings/schemas.ts`
   - `convex/functions/vesselLocation/schemas.ts`
   - `convex/functions/activeVesselTrips/schemas.ts`
   - `convex/functions/completedVesselTrips/schemas.ts`
   - `convex/functions/currentVesselLocation/schemas.ts`
   - `convex/functions/predictions/schemas.ts`

3. **Domain Layer Updated** (4 files):
   - `src/domain/vessels/vesselLocation.ts`
   - `src/domain/vessels/activeVesselTrip.ts`
   - `src/domain/vessels/completedVesselTrip.ts`
   - `src/domain/vessels/vesselPing.ts`

4. **Main Schema**:
   - `convex/schema.ts` - Already using validators (no changes needed)

### Migration Pattern

For each schema file:

1. **Replace Convex validators with Zod schemas**:
   ```typescript
   // Before
   export const schema = v.object({ TimeStamp: v.number() });
   
   // After
   const zodSchema = z.object({ TimeStamp: epochMillisToDate });
   export const schema = zodToConvex(zodSchema);
   ```

2. **Update types**:
   ```typescript
   // Before
   export type ConvexType = Infer<typeof schema>;
   
   // After
   export type DomainType = z.infer<typeof zodSchema>;
   export type ConvexType = Infer<typeof convexValidator>;  // Inferred from validator!
   ```

3. **Simplify conversion functions**:
   ```typescript
   // Before
   export const toDomain = (convex: ConvexType) => ({
     ...convex,
     TimeStamp: new Date(convex.TimeStamp),
   });
   
   // After
   export const toDomain = (convex: ConvexType) => zodSchema.decode(convex);
   ```

### Schema Extension Migration

**Before** (field spreading):
```typescript
export const completedSchema = v.object({
  ...activeSchema.fields,  // ❌
  additionalField: v.string(),
});
```

**After** (Zod extend):
```typescript
export const completedZodSchema = activeZodSchema.extend({
  additionalField: z.string(),  // ✅
});
export const completedSchema = zodToConvex(completedZodSchema);
```

---

## Benefits and Improvements

### 1. Single Source of Truth

- ✅ Each schema defined once in Zod
- ✅ No field duplication or spreading
- ✅ Changes propagate automatically

### 2. Automatic Transformations

- ✅ No manual `.getTime()` calls
- ✅ No manual `new Date()` conversions
- ✅ Type-safe transformations

### 3. Better Type Safety

- ✅ Zod provides excellent TypeScript inference
- ✅ Compile-time guarantees
- ✅ Consistent types throughout

### 4. Reduced Boilerplate

- ✅ Domain conversion: 1 line instead of 10+
- ✅ Eliminated ~200-300 lines of conversion code
- ✅ Eliminated ~150+ lines of manual type definitions
- ✅ Easier to maintain

### 5. Schema Extension

- ✅ Type-safe extension with `.extend()`
- ✅ No field spreading
- ✅ Proper inheritance

### 6. Single Source of Truth for Types

- ✅ Convex types inferred from validators using `Infer<typeof validator>`
- ✅ No manual type definitions needed
- ✅ Types automatically stay in sync with schemas
- ✅ Changes to schemas automatically update types

### Code Reduction Example

**Before** (manual conversion):
```typescript
export const toDomainVesselLocation = (location: ConvexVesselLocation) => ({
  ...location,
  LeftDock: toDateOrUndefined(location.LeftDock),
  Eta: toDateOrUndefined(location.Eta),
  ScheduledDeparture: toDateOrUndefined(location.ScheduledDeparture),
  TimeStamp: new Date(location.TimeStamp),
});
```

**After** (Zod decode):
```typescript
export const toDomainVesselLocation = (location: ConvexVesselLocation) =>
  vesselLocationSchema.decode(location);
```

**Reduction**: 5 lines → 1 line (80% reduction)

### Type Definition Reduction Example

**Before** (manual type definition):
```typescript
export type ConvexVesselLocation = {
  VesselID: number;
  VesselName?: string;
  DepartingTerminalID: number;
  DepartingTerminalName?: string;
  DepartingTerminalAbbrev?: string;
  ArrivingTerminalID?: number;
  ArrivingTerminalName?: string;
  ArrivingTerminalAbbrev?: string;
  Latitude: number;
  Longitude: number;
  Speed: number;
  Heading: number;
  InService: boolean;
  AtDock: boolean;
  LeftDock?: number;
  Eta?: number;
  ScheduledDeparture?: number;
  OpRouteAbbrev?: string;
  VesselPositionNum?: number;
  TimeStamp: number;
};
```

**After** (inferred from validator):
```typescript
import type { Infer } from "convex/values";
export type ConvexVesselLocation = Infer<typeof vesselLocationValidationSchema>;
```

**Reduction**: 25+ lines → 2 lines (92% reduction)

---

## References and Sources

### Official Documentation

1. **Zod Codecs Documentation**
   - URL: https://zod.dev/codecs
   - Description: Official Zod documentation for the codec API
   - Key concepts: Bidirectional transformations, encode/decode methods

2. **Introducing Zod Codecs (Colin McDonnell)**
   - URL: https://colinhacks.com/essays/introducing-zod-codecs
   - Description: Detailed introduction to Zod 4.1 codec feature
   - Key points:
     - Codecs solve the problem of bidirectional transformations
     - `.decode()` vs `.parse()` differences
     - How encoding works with transforms, pipes, and refinements
     - Official codec examples

3. **Convex Helpers - Zod Validation**
   - URL: https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#zod-validation
   - Description: Documentation for using Zod with Convex
   - Key functions: `zodToConvex()`, `convexToZod()`

4. **Convex Stack - TypeScript Zod Function Validation**
   - URL: https://stack.convex.dev/typescript-zod-function-validation
   - Description: Guide for using Zod for function argument validation in Convex
   - Key concepts: `zCustomQuery`, `zCustomMutation`, type-safe validation

### Key Concepts from Sources

1. **Codec Directionality** (from colinhacks.com):
   - `.decode()`: Input format → Output format (e.g., number → Date)
   - `.encode()`: Output format → Input format (e.g., Date → number)
   - `.parse()`: Equivalent to `.decode()` but accepts `unknown`

2. **Integration with Convex** (from convex-helpers):
   - `zodToConvex()` converts Zod schemas to Convex validators
   - Codecs are handled automatically - encoded format (numbers) is stored
   - Validators work seamlessly with `defineTable()` and function args

3. **Best Practices** (from Zod docs):
   - Use codecs for bidirectional transformations
   - Don't use `.transform()` with `.encode()` - use `z.codec()` instead
   - Refinements work in both directions
   - Defaults only apply in decode direction

### Version Information

- **Zod**: v4.1.12+ (codec feature introduced in 4.1)
- **convex-helpers**: v0.1.105+ (supports Zod codecs)
- **Convex**: v1.26.2+

---

## Summary

The refactoring to Zod 4 with `z.codec` provides:

1. **Single source of truth** for all schemas
2. **Automatic Date ↔ number transformations** via codecs
3. **Type-safe schema extension** (no more field spreading)
4. **Reduced boilerplate** in conversion functions
5. **Inferred types** - Convex types derived from validators using `Infer<typeof validator>`
6. **Better maintainability** and consistency

The system now uses Zod schemas as the authoritative definition, with codecs handling the transformation between domain (Date) and storage (number) formats automatically. Convex types are inferred from validators using `Infer<typeof validator>` from `convex/values`, eliminating the need for manual type definitions.

**Key improvements:**
- **Automatic type synchronization**: Changes to schemas automatically update types
- **No type duplication**: Types are derived from a single source (the validator)
- **Compile-time guarantees**: Types stay in sync with validation logic
- **Reduced maintenance**: No need to manually update types when schemas change

This eliminates manual conversion code and manual type definitions (~150+ lines removed), providing compile-time guarantees for data transformations.

