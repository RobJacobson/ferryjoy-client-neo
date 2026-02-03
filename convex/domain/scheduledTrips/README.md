# Scheduled Trips Domain

This domain manages the transformation of raw Washington State Ferries (WSF) schedule data into a structured, physical vessel movement model.

## The WSF Data Model vs. Physical Reality

The raw WSF API provides schedule data in a "marketing-centric" flat format. This model is designed for passengers looking for a specific trip from Point A to Point B, but it obscures the physical reality of the vessel's movements.

### The "San Juan Islands Problem"
The San Juan Islands route (Route 9) is the primary driver for our complex domain logic. On this route, a single physical vessel departure from a terminal often represents multiple logical "trips" to different destinations.

**Example:**
A vessel departs **Anacortes (ANA)** at 9:45 AM. The WSF API reports three separate trips for this one departure:
1. ANA → Lopez (LOP)
2. ANA → Shaw (SHI)
3. ANA → Friday Harbor (FRH)

In reality, this is one boat following a path: `ANA → LOP → SHI → FRH`. 

### Why We Transform the Data
If we used the raw WSF model, our UI would show three separate boats leaving Anacortes at the same time. To provide an accurate "FerryJoy" experience, we must:
1.  **Deduplicate**: Recognize that these are "different views" of the same physical journey.
2.  **Reconstruct**: Follow the chain of stops to show the user the full timeline of where the boat is going.
3.  **Standardize**: Align all data on the **WSF Sailing Day** (3:00 AM Pacific rollover) to prevent late-night data mismatches.

---

## The Solution: Physical Departure Grouping

Our backend addresses these problems by standardizing on the **Physical Departure** as the primary unit of work. A physical departure is uniquely identified by `(Vessel, Departing Terminal, Departure Time)`.

### 1. Ingestion Pipeline (`convex/domain/scheduledTrips/transform`)
When we sync data, we run a functional transformation pipeline:

*   **Grouping**: We group all raw trips by their physical departure using the standardized `PhysicalDeparture` utility.
*   **Classification**: For each group, we identify the **Direct** trip (the immediate next stop) versus **Indirect** trips (stops further down the chain). This is done by looking ahead at the vessel's next scheduled departure terminal.
*   **Key Linking**: We link segments using `PrevKey` and `NextKey` pointers in a single stateful pass, creating a linked-list of the vessel's entire day.
*   **Time Estimation**: We backfill missing arrival times for indirect trips by looking ahead to their corresponding direct completion segments.

### 2. Query Pipeline (`convex/domain/scheduledTrips/journeys.ts`)
When a user views a terminal schedule, we reconstruct the journeys on-the-fly:

*   **Physical Scan**: We fetch all departures from the requested terminal for the current Sailing Day and group them into physical movements.
*   **Chain Reconstruction**: Starting from the "Direct" segment of a departure, we follow the `NextKey` pointers until we reach the final destination of that logical journey.
*   **Intelligent Target Selection**: If a user is looking at a specific destination (e.g., "Anacortes to Friday Harbor"), we pick that specific chain. If they are looking at "All Departures," we pick the furthest destination in each physical chain to represent the boat's full path.

---

## File Outline

### `convex/domain/scheduledTrips/`
*   **`grouping.ts`**: **Standardized utility** for identifying physical vessel movements. Defines the `PhysicalDeparture` type used across the domain.
*   **`journeys.ts`**: High-level logic for reconstructing physical chains into UI-ready `ScheduledJourney` objects.
*   **`transform/`**: The ingestion pipeline logic.
    *   `pipeline.ts`: Coordinates the classification and estimation steps.
    *   `classification.ts`: Functional logic for distinguishing Direct vs. Indirect trips using lookahead.
    *   `estimates.ts`: Single-pass logic for linking keys and calculating arrival times (backfilling indirects).
    *   `officialCrossingTimes.ts`: Static reference for curated crossing durations.

### `convex/functions/scheduledTrips/`
*   **`sync/`**: The "Fetch & Save" orchestration.
    *   `sync.ts`: High-level coordinator for the daily sync process.
    *   `fetching/`: WSF API clients and raw data mapping.
    *   `persistence.ts`: Atomic database replacement logic.
*   **`queries.ts`**: Public API for the frontend, delegating reconstruction to the domain layer.
*   **`schemas.ts`**: Zod/Convex schemas defining the `ScheduledTrip` and `ScheduledJourney` types.
