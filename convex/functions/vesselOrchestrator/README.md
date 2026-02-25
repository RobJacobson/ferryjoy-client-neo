# VesselOrchestrator - Real-Time Ferry Trip Tracking Coordination

The VesselOrchestrator is the top-level coordination layer that orchestrates the entire pipeline for processing vessel location data. It fetches vessel locations from external APIs once and delegates to specialized processing functions with robust error isolation.

## System Overview

The orchestrator runs periodically (every 5 seconds) to process real-time vessel location updates from the Washington State Ferries API. It serves as the coordination hub that:

1. Fetches vessel locations from the WSF API (ws-dottie)
2. Converts and enriches location data with terminal distance calculations
3. Stores location snapshots in the database
4. Delegates complex trip lifecycle management to the vesselTrips/updates module

The orchestrator eliminates duplicate API calls by fetching vessel locations once and passing the same data to both the location storage and trip update subsystems. Failures in one subsystem do not prevent the other from executing.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  WSF API        │───▶│ VesselOrchestrator│───▶│ Vessel Location │
│  (ws-dottie)    │    │                  │    │ Database        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Vessel Trip     │───▶│ Trip & ML       │
                       │ Updates Module  │    │ Databases       │
                       └─────────────────┘    └─────────────────┘
```

## Architecture Components

### 1. Orchestrator Action (`actions.ts`)

**Purpose**: Main coordination hub that fetches, transforms, and delegates vessel location updates.

**Key Function**: `updateVesselOrchestrator()`

**Responsibilities**:
- Fetches vessel locations from WSF API via `fetchVesselLocations()`
- Converts `DottieVesselLocation` to `ConvexVesselLocation` format
- Enriches locations with distance calculations to departing/arriving terminals
- Calls location storage and trip update subroutines with error isolation
- Returns success/failure status for each processing branch

**Data Transformation Pipeline**:
```
DottieVesselLocation (WSF API)
    ↓
toConvexVesselLocation() - Schema conversion
    ↓
Add terminal distance calculations (DepartingDistance, ArrivingDistance)
    ↓
convertConvexVesselLocation() - Additional transformations
    ↓
ConvexVesselLocation[] - Ready for downstream processing
```

**Error Isolation**: Failures in location storage or trip updates are caught independently. One failure does not prevent the other from executing.

### 2. Vessel Location Storage (`vesselLocation/`)

**Purpose**: Stores vessel location snapshots in the database.

**Key Functions**:
- **`bulkUpsert` mutation**: Efficiently upserts all vessel locations in a single atomic transaction
  - Fetches all existing locations by VesselID index
  - Replaces existing records or inserts new ones
  - Returns statistics (total, updated, inserted counts)

**Database Table**: `vesselLocations`
- One record per vessel
- Completely replaced on each update (not incremental patches)
- Provides historical point-in-time snapshots for analysis

### 3. Vessel Trip Updates (`vesselTrips/updates/`)

**Purpose**: Handles complex ferry trip lifecycle management and ML prediction generation.

The orchestrator delegates all trip update logic to the `runUpdateVesselTrips()` function, which is implemented as a separate module with its own comprehensive documentation.

**Key Aspects**:
- Trip state management (first trip, trip boundary, regular updates)
- Event-driven detection and handling
- Schedule enrichment and terminal lookup
- ML prediction generation and actualization
- Build-then-compare pattern to minimize database writes

For detailed information about the trip updates module, see: `convex/functions/vesselTrips/updates/README.md`

## Data Flow

The orchestrator follows a clear data flow from external API to database storage:

```
WSF API (ws-dottie)
    ↓ fetchVesselLocations()
DottieVesselLocation[]
    ↓ toConvexVesselLocation()
ConvexVesselLocation[] (schema conversion)
    ↓ Enrich with terminal distances
ConvexVesselLocation[] (with DepartingDistance, ArrivingDistance)
    ↓ convertConvexVesselLocation()
ConvexVesselLocation[] (final format)
    ↓
┌─────────────────┬─────────────────┐
│                 │                 │
│   Branch 1      │    Branch 2     │
│ (error isolated)│ (error isolated)│
│                 │                 │
│ vesselLocation  │ vesselTrips/    │
│ bulkUpsert()    │ updates module  │
│                 │                 │
└────────┬────────┴────────┬────────┘
         │                 │
         ▼                 ▼
   vesselLocations    vesselTrips
   table           (active/completed)
                     + predictions
```

## Execution Model

### Periodic Execution

The orchestrator runs on a 5-second schedule (configured via cron or scheduled action), providing near real-time tracking while managing system load.

### Error Handling

The orchestrator implements two levels of error isolation:

**1. Subsystem-Level Isolation**:
- Location storage failures do not prevent trip updates from running
- Trip update failures do not prevent location storage from running
- Each subsystem is wrapped in its own try-catch block

**2. Per-Vessel Isolation** (within vesselTrips/updates module):
- Individual vessel processing failures do not stop the entire batch
- Errors are logged and collected, but processing continues for other vessels

**Error Reporting**:
```typescript
{
  locationsSuccess: boolean,
  tripsSuccess: boolean,
  errors?: {
    locations?: { message: string; stack?: string },
    trips?: { message: string; stack?: string }
  }
}
```

### Performance Considerations

**Database Efficiency**:
- Vessel location storage uses batch upsert in a single atomic transaction
- Trip updates use optimized queries and batch operations

**API Efficiency**:
- Single API call to fetch all vessel locations (no duplicate calls)
- Data is reused across both storage and trip update branches

**Memory Efficiency**:
- Processing streams locations through the pipeline
- No unnecessary duplication of data structures

## Key Differences: Orchestrator vs. Trip Updates

| Aspect | VesselOrchestrator | vesselTrips/updates |
|--------|-------------------|---------------------|
| **Scope** | High-level coordination | Detailed trip lifecycle logic |
| **Primary Responsibility** | Fetch, transform, and delegate | Trip state management and ML predictions |
| **External Dependencies** | WSF API (ws-dottie) | Internal database queries and ML models |
| **Complexity** | Simple data flow and delegation | Sophisticated event detection and state machine |
| **Documentation Focus** | System architecture and integration | Implementation details and algorithms |

## Monitoring & Logging

The orchestrator provides logging for:

**Success/Failure Tracking**:
- Location update success/failure
- Trip update success/failure
- Error messages and stack traces for failures

**Console Output**:
- Errors are logged to console with context
- Successful execution returns status object (can be logged by calling code)

The vesselTrips/updates module provides its own detailed logging for:
- Event counts (first trip, trip boundary, regular updates)
- Prediction statistics
- Database write counts (upserts, completions, prediction records)
- Per-vessel error details

See `convex/functions/vesselTrips/updates/README.md` for details on trip update logging.

## Error Handling & Resilience

### Error Isolation Strategy
The orchestrator ensures failures in one component don't affect others:

```typescript
// Each operation runs independently with error capture
const locationsSuccess = await updateVesselLocations(ctx, locations).catch(error => false);
const tripsSuccess = await runUpdateVesselTrips(ctx, locations).catch(error => false);
```

**Per-Vessel Failure Handling**: The vesselTrips/updates module implements individual vessel error isolation. Failures in processing one vessel do not prevent other vessels from being processed. Errors are logged and collected without stopping the batch.

## Performance Optimizations

### Orchestrator-Level Optimizations
- **Single API Call**: Fetches all vessel locations once, eliminating duplicate WSF API calls
- **Batch Processing**: Processes all vessels in a single execution
- **Error Isolation**: Fast-fail errors without stopping other subsystems

### Database Efficiency (vesselLocation module)
- **Batch Upsert**: All location updates performed in a single atomic transaction
- **Index Utilization**: Uses VesselID index for efficient lookups

### Trip Updates Module Optimizations
The vesselTrips/updates module implements several optimizations:
- **Event-Gated Operations**: Expensive lookups and predictions only run at specific events, not every tick
- **Build-Then-Compare**: Only writes to database when trip data actually changes
- **Batch Operations**: Active trips are batched and upserted together
- **ScheduledTrip Reuse**: Reuses existing schedule data when trip key hasn't changed
- **Batch Model Loading**: Loads ML models in batch when computing multiple predictions for a vessel

See `convex/functions/vesselTrips/updates/README.md` for detailed performance optimizations in the trip updates module.

## Related Documentation

- **`convex/functions/vesselTrips/updates/README.md`** - Comprehensive documentation of the vessel trip updates module, including:
  - Detailed architecture of the 5-function design (buildTrip, baseTripFromLocation, appendInitialSchedule, appendFinalSchedule, appendPredictions)
  - Centralized event detection via `detectTripEvents()`
  - Event-driven processing for first trip, trip boundaries, and regular updates
  - ML prediction generation and actualization lifecycle
  - Build-then-compare pattern for database write optimization
  - Field reference table with update rules
  - Complete API documentation and Convex function calls

- **`convex/domain/ml/readme-ml.md`** - ML pipeline overview and model documentation

- **`convex/functions/vesselLocation/`** - Vessel location storage module documentation

## Summary

The VesselOrchestrator provides a clean, high-level coordination layer that:

1. **Fetches and transforms** vessel location data from external APIs
2. **Delegates** to specialized subsystems (location storage and trip updates)
3. **Isolates errors** between subsystems to maintain system resilience
4. **Provides clear separation of concerns** with focused, well-documented modules

The orchestrator keeps its implementation simple while delegating complex trip lifecycle management and ML prediction logic to the vesselTrips/updates module, which is documented separately for developers who need deep understanding of those systems.