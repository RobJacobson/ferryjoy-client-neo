# Glossary: Vessel Trip and Location Timestamps (Current Code)

Date: 2026-04-15  
Audience: engineers and coding agents working on vessel trips, timelines, ML, and clients  
Status: reference — **what exists now** and how it fits together (not a migration story)

## How to use this document

- Treat it as the **shared vocabulary** for timestamps in the ferry domain layer.
- **Physical boundary** facts (dock arrivals and departure) use specific `*Actual` fields and feed times — not coverage fields and not server wall clock.
- **Coverage** fields describe **how long this trip row is “live” in our system**, including synthetic closes and gaps.
- When in doubt, check **`convex/functions/vesselTrips/schemas.ts`** for persisted shapes and **`toDomainVesselTrip`** for API/domain `Date` conversion.

---

## 1. Single domain clock

**All lifecycle and boundary meaning uses feed time**, aligned to **`ConvexVesselLocation.TimeStamp`** (epoch ms from the WSF-derived location sample). Trip rows copy that notion when they stamp events; **do not** use `Date.now()` (or equivalent) for trip lifecycle semantics, ML boundary features, or timeline “what happened when” facts.

**Implication:** timestamps are **observation times** (with normal feed delay), not wall-clock “true instant” of the physical event. Consistency within one coordinate system matters more than absolute latency.

### WSF feed: polling, tick spacing, and latency

The app ingests **WSF** vessel positions into **`ConvexVesselLocation`**. In production we **poll for new location documents every five seconds** using a cron job. That interval is only an upper bound on how often we *look*: **each vessel’s updates arrive on their own cadence**. In practice, successive ticks for a given vessel are often **roughly five to ten seconds apart**, sometimes longer, and **not predictable** from our side.

Two consequences matter for agents:

1. **Sampling / strobing.** Events are only observed when a tick lands. Combined with irregular spacing, the time we first *see* a boundary can **lag the physical moment by a few seconds beyond** the feed’s own delay — a form of **strobing** tied to poll timing and tick jitter. Do not assume we can resolve “which second” something happened at sea or at the dock beyond what the feed’s **`TimeStamp`** carries.

2. **Inherent feed lag.** **`TimeStamp`** values on samples are typically **about ten to twenty seconds behind wall-clock time** at the moment we process them. That offset comes from upstream WSF and propagation; **we do not control it**. The domain model still treats **`TimeStamp`** as the authoritative clock for trip lifecycle and boundaries; wall clock is not used to “correct” feed time.

---

## 2. Live vessel location (`ConvexVesselLocation`)

Each tick is a **sample** from the pipeline. Relevant time fields:

| Field | Source | Meaning |
|--------|--------|---------|
| **`TimeStamp`** | Feed | **Domain clock** for this observation — primary anchor for anything derived in the same tick. |
| **`LeftDock`** | Feed | Optional epoch ms when the feed last reported **leave dock** for this context; raw signal, not necessarily debounced into trip lifecycle. |
| **`ScheduledDeparture`** | Feed / schedule alignment | Scheduled departure for the current segment when known (epoch ms). |
| **`Eta`** | Feed | Operator or derived ETA toward the **arriving** side (epoch ms); useful for UI and fallbacks, not a stored **actual** arrival boundary on the trip row. |

**`ScheduleKey`** on locations is **schedule-segment identity**, not the immutable **physical trip** identity (`TripKey` on trips).

---

## 3. Vessel trip rows (`activeVesselTrips` / `completedVesselTrips`)

Trips are built and updated in **`convex/functions/vesselTrips/updates/tripLifecycle/`** and related domain code. Persisted trips **do not embed full ML blobs**; predictions are joined from **`eventsPredicted`** on read paths that hydrate predictions.

### 3.1 Coverage interval (recording window)

These define **when this row is considered to exist** in our data, including edge cases (cold start, resume, synthetic close).

| Field | Meaning |
|--------|---------|
| **`StartTime`** | When this trip instance **entered** the recorded window (typically aligned with opening the row on a feed tick). |
| **`EndTime`** | When this trip’s **recorded interval closed** — completion, chain handoff, or **synthetic** close (e.g. superseded row when starting a new trip after ambiguity). **Synthetic `EndTime` does not imply destination arrival.** |

**Rule:** **`StartTime` / `EndTime` are not physical dock boundaries.** Do not drive `dep-dock` / `arv-dock` facts, ML boundary features, or `eventsActual` assembly from coverage alone.

### 3.2 Physical boundary actuals (asserted when the pipeline can)

**One name per concept.** All are optional; none should be invented to “fill gaps.”

| Field | Meaning |
|--------|---------|
| **`ArrivedCurrActual`** | Asserted **arrival at the origin (departing) dock** for **this** sailing — feed time when we stand behind that boundary. |
| **`ArrivedNextActual`** | Asserted **arrival at the destination dock** for **this** sailing. |
| **`LeftDockActual`** | Asserted **departure from the departing terminal** (physical leave-dock / `dep-dock`). |

**Chain invariant (happy path):** for adjacent trips in the same chain,  
`previousTrip.ArrivedNextActual === nextTrip.ArrivedCurrActual`  
(both are the same feed instant at the handoff).

### 3.3 Transitional and mirror fields (still on the row; read with care)

These exist for **compatibility, UI, and gradual migration** of readers. They overlap semantically with coverage or physical fields; **prefer the glossary fields in §3.1–3.2** for new logic.

| Field | Typical role today |
|--------|---------------------|
| **`TripStart`** | Often tracks “start of trip” for lists and legacy gating; may align with **`StartTime`** in happy paths but is **not** by itself a guaranteed **`ArrivedCurrActual`**. |
| **`TripEnd`** | Completion stamp; often aligns with **`EndTime`** / destination-side events in happy paths; still distinguish from asserted **`ArrivedNextActual`**. |
| **`AtDockActual`** | Mixed **dock-phase / first-seen / carry** behavior — **do not** treat as a trusted physical origin arrival for ML or `eventsActual` unless product code explicitly documents otherwise. |
| **`ArriveDest`** | Destination-side arrival signal used in older paths; when **`ArrivedNextActual`** is set, prefer **`ArrivedNextActual`**. |
| **`LeftDock`** | Raw **mirror** of feed-style leave time on the trip row; **`LeftDockActual`** is the asserted boundary for projection and ML when present. |

### 3.4 Durations, delay, and list-sort helpers

| Field | Meaning |
|--------|---------|
| **`AtDockDuration`** | Derived time **at dock** (origin side), from trip state — not a raw feed field. |
| **`AtSeaDuration`** | Derived **underway** segment duration where applicable. |
| **`TotalDuration`** | Derived end-to-end duration for the row’s story. |
| **`TripDelay`** | Derived delay vs schedule (see **`ScheduledDeparture`**). |

### 3.5 Schedule and chain context (epoch ms)

| Field | Meaning |
|--------|---------|
| **`ScheduledDeparture`** | This segment’s scheduled departure (when attached). |
| **`PrevScheduledDeparture`** | Previous segment context for ML and predictions. |
| **`PrevLeftDock`** | Previous trip’s departure boundary context (see lifecycle writers). |
| **`NextScheduleKey` / `NextScheduledDeparture`** | Forward segment hints when the pipeline has attached a next leg. |

### 3.6 Per-tick trip cursor

| Field | Meaning |
|--------|---------|
| **`TimeStamp`** (on trip row) | **Latest** feed observation time carried on the row for this processing context — **not** the same thing as **`StartTime`** / **`EndTime`** unless explicitly set that way by writers. |

### 3.7 ML prediction blobs (joined, not stored on persisted trip docs)

On hydrated trips, optional fields such as **`AtDockDepartCurr`**, **`AtDockArriveNext`**, **`AtDockDepartNext`**, **`AtSeaArriveNext`**, **`AtSeaDepartNext`** hold **model outputs** (full or minimal joined shape). They use **`PredTime`** / **`Actual`** (and related deltas) in **prediction time**, not trip boundary semantics.

- **Persistence:** mutations strip these off **`activeVesselTrips`** / **`completedVesselTrips`**; **`eventsPredicted`** stores prediction rows keyed for join.
- **Actualization:** when a physical boundary is known, code may write **`Actual`** on the joined prediction (e.g. leave-dock, arrive-next) for display — still distinct from trip **`ArrivedNextActual`** / **`LeftDockActual`**.

---

## 4. Projected actuals (`eventsActual`)

**`eventsActual`** holds **normalized boundary events** for the timeline (e.g. `dep-dock`, `arv-dock`). Sparse **patches** are built from finalized trips in **`actualBoundaryPatchesFromTrip.ts`**: departure uses **`LeftDockActual`**; destination arrival uses **`ArrivedNextActual`**. Patches require **`TripKey`** and terminal fields as documented there; they **do not** infer boundaries from **`StartTime`/`EndTime`**.

**`EventActualTime`** on stored rows is the boundary instant in the same epoch-ms system.

---

## 5. Client / domain `Date` conversion

**`toDomainVesselTrip`** converts numeric epoch fields on Convex trips to **`Date`** on the client domain type **`VesselTrip`**. Helpers under **`src/features/TimelineFeatures/shared/utils/tripTimeHelpers.ts`** centralize **display and fallback** chains (e.g. **`getBestDepartureTime`**, **`getDestinationArrivalOrCoverageClose`**) so UI does not scatter legacy precedence rules.

---

## 6. Quick rules for agents

| Question | Answer |
|----------|--------|
| What clock do we use for “when did this happen”? | Feed **`TimeStamp`** on locations; same ms system on trips and **`eventsActual`**. |
| What marks **coverage**? | **`StartTime`** / **`EndTime`**. |
| What marks **physical** depart/arrive? | **`LeftDockActual`**, **`ArrivedCurrActual`**, **`ArrivedNextActual`**. |
| May **`EndTime`** imply arrival? | **No** — check **`ArrivedNextActual`** (or product-specific fallbacks documented in UI helpers). |
| Where do predictions live on disk? | **`eventsPredicted`**, joined at query time — not embedded on stored trip tables. |
| What must ML / timeline boundary code read? | Physical fields in §3.2 (and schedule context as needed), not coverage as a substitute. |
| How “live” is feed time vs wall clock? | See **§1 — WSF feed: polling, tick spacing, and latency**; expect ~10–20s feed lag and irregular tick spacing. |

---

## 7. Related specs (deeper design)

- [trip-timestamp-semantics-memo-2026-04-14.md](./trip-timestamp-semantics-memo-2026-04-14.md) — semantic baseline and invariants (two layers, chain behavior, synthetic close).
- [trip-timestamp-semantics-prd-2026-04-14.md](./trip-timestamp-semantics-prd-2026-04-14.md) — staged implementation expectations.
- **`convex/functions/vesselTrips/updates/README.md`** — write-path behavior for lifecycle and debounce.

Scheduled-trip segment times (**`SchedArriveCurr`**, **`SchedArriveNext`**, **`EstArriveCurr`**, **`EstArriveNext`**, etc.) live on **`scheduledTrips`** shapes and UI segment models; they describe **schedule / estimates** for multi-segment cards, complementary to **vessel trip actuals** above.
