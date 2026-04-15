# Engineering Memo: Vessel Trip Timestamp Semantics and Standardization

Date: 2026-04-14 (revised 2)  
Audience: engineers working on `vesselTrips`, ML, timeline projection, and related clients  
Status: semantic baseline — shared vocabulary for the refactor; not an implementation checklist

## 1. Purpose and scope

### Why this memo exists

Several fields on vessel trip rows mix **three different ideas** under similar names (`*Actual`, `TripStart`, `AtDock*`, `LeftDock*`, `ArriveDest`, `TripEnd`):

- **Recording coverage** — when our system first and last represents this trip instance.
- **Trusted physical boundaries** — when we assert real dock-side events (arrival at origin and destination, **and** departure from origin, for this sailing).
- **Lifecycle bookkeeping** — completing a row, chaining to the next trip, gating predictions.

That overlap makes **correct reasoning and refactors** harder than necessary. This memo records **agreed terminology and semantics** for a **time-based refactor**: standardize **what we store**, **why**, and **how it differs from today**, without prescribing file-by-file changes.

### Scope

**In scope**

- Meaning of timestamps on **active** and **completed** vessel trip records.
- Relationship to **feed time** (`ConvexVesselLocation.TimeStamp`) as the single domain clock.
- Invariants for **happy path** (same tick for arrival → complete → start next leg).
- Distinction between **optional physical boundary actuals** (arrivals + departure) and **coverage bounds** (`StartTime` / `EndTime`).

**Out of scope here**

- Concrete schema migrations, dual-write plans, or deprecation order.
- UI copy and exact API field renames in the client (those follow once backend names stabilize).

---

## 2. Current state: conflicting and overloaded terms

### `TripStart`

Documented as **“observed boundary ownership”** — used for prediction gating, ML features (e.g. slack, durations), and UI. It is **not** purely “arrival at the departing dock.” On a **trip start** after completion, it has been derived from the **completed trip’s `TripEnd`**, which ties the new row to the prior row’s end. In **cold start** scenarios, it may remain **undefined** until a trustworthy boundary exists.

### `AtDockActual`

The name suggests **“an actual at-dock boundary.”** In practice the implementation also carries **first observation**, **carry-forward**, and **fallback** behavior (including cases better described as **“when we first recorded something about dock phase for this row”** than as a verified maritime boundary). That makes the field **misleading** as a physical dock event.

### `TripEnd` / completion

Marks **trip completion** on the row (lifecycle close). Often aligned with **destination arrival** in the happy path, but the name does not distinguish **“coverage ended”** from **“we asserted arrival at destination dock.”**

### `ArriveDest`

Closer to **destination arrival** for this sailing when the pipeline trusts it, and is used for **`arv-dock`** projection. It does not by itself solve naming consistency with **origin** dock arrival or with **coverage**.

### `LeftDock` / `LeftDockActual`

These are **first-class** in today’s pipeline: **departure from the departing terminal** (physical **leave-dock** / `dep-dock` boundary). `buildDepartureActualPatchForTrip` prefers `LeftDockActual` and falls back to `LeftDock`. ML and timeline code treat this boundary as **real** when present. Unlike arrival-side naming, departure is **not** overloaded in the same way as `AtDockActual`, but it still needs an explicit place in the **new taxonomy** next to arrival actuals so the model does not look “arrival + coverage only.”

### Summary problem

**Same words** (`Actual`, `Trip*`) have been used for **recording window**, **chain handoff**, and **asserted dock events**. Departure semantics stayed comparatively clear, but **arrival + coverage** were conflated. This refactor standardizes **all** physical boundaries (depart + arrive) **and** coverage in one framework.

---

## 3. Decisions: two layers of time

We standardize on **two coverage timestamps** plus **physical boundary actuals** (arrivals **and** departure) in one taxonomy. Together they replace the old mix of roles without leaving departure outside the model.

### Layer A — Optional **physical boundary actuals** (when the pipeline can assert them)

**Canonical names (recommended for docs and public APIs):** these read clearly on first encounter and mirror **origin vs destination** for **this** segment.

| Canonical name | Shorter alias (acceptable in code) | Role |
|----------------|-------------------------------------|------|
| **`ArriveOriginDockActual`** | `ArriveCurrActual` | Asserted arrival at the **origin dock** for **this** sailing, when the pipeline can stand behind it. |
| **`ArriveDestDockActual`** | `ArriveNextActual` | Asserted arrival at the **destination dock** for **this** sailing, when known. |
| **`DepartOriginActual`** | — (legacy: **`LeftDockActual`** / **`LeftDock`**) | Asserted **departure from the departing terminal** (leave origin dock) for **this** sailing — the physical counterpart to `dep-dock` projection and ML. |

**Departure naming decision:** **`DepartOriginActual`** is the **preferred semantic name** going forward (pairs with “origin” on the arrival side). Today’s **`LeftDockActual`** remains the **stored** field until a rename migration; its meaning after refactor is exactly **`DepartOriginActual`** (not coverage, not `AtDock`-style noise).

**Cold start / unknown:** any of these may be **undefined**. They are **not** filled with guesses that pretend to be physical boundaries.

**Chain invariant (happy path, destination arrival):** for adjacent trips in the same chain,

`previousTrip.ArriveDestDockActual === nextTrip.ArriveOriginDockActual`

(abbreviated: `previousTrip.ArriveNextActual === nextTrip.ArriveCurrActual`). Both sides are feed timestamps for the **same** boundary instant.

**Naming note:** Shorter aliases align with **Curr / Next** language used in predictions, but they label **this segment’s origin vs destination terminals**, not “the next trip row” or **`AtDockArriveNext`** **prediction** blobs. Prefer **canonical** names in specs and reviews where clarity matters; use aliases where brevity wins and the glossary is nearby.

### Layer B — **Coverage / recording interval** (`StartTime` / `EndTime`)

These describe **only** the **period this trip row represents in our system** — including glitches, gaps, and resumption after outages.

| Proposed name   | Role |
|-----------------|------|
| **`StartTime`** | When this trip instance **entered** our recorded window (e.g. first tick we associate with this trip). |
| **`EndTime`**   | When this trip instance’s **recorded interval** **closes** — completion, identity split, or explicit end of this row’s validity. |

**Hard rule:** **`StartTime` / `EndTime` are coverage semantics only.** They must **never** be treated as **physical dock boundaries** by ML feature extraction, timeline projection, or `eventsActual` assembly. Those layers must read **Layer A** actuals (arrivals + departure) or dedicated boundary tables — not infer `dep-dock` / `arv-dock` from coverage alone.

On **cold start**, **`StartTime`** is the **first time we recorded** the trip; we do not pretend we know **`ArriveOriginDockActual`**. **`EndTime`** may still be set when the row closes even if **`ArriveDestDockActual`** is unknown (synthetic close).

**Happy path:** **`StartTime` / `EndTime`** align with the same feed times as the **physical** actuals when full information exists in one coherent story (see **Worked example** above).

**Warm start (resume after unavailable data):** heuristics decide **same trip vs new trip**. If the system creates a **new** trip, the **superseded** row’s **`EndTime`** may be set to the **resume tick** as a **synthetic close** of coverage — meaning **“we closed the book here,”** not necessarily a physical event at that instant. That avoids updating **`EndTime`** on every tick (churn and non-semantic writes). Layer A fields remain **honest** (undefined if we cannot assert the boundary).

### Worked example: happy path (one sailing, canonical names)

All times are **feed** `TimeStamp` values on the ticks that assert each fact.

1. **Trip *N* opens** after **complete-and-start** from trip *N−1* on tick **`t₀`**. On that **same** tick, coverage opens and we assert arrival at the **origin dock** for this leg: **`StartTime = t₀`**, **`ArriveOriginDockActual = t₀`**. (This is where legacy **`TripStart`** often **equals** **`StartTime`**: same instant, **not** two different clocks.)

2. Vessel **leaves** the origin: **`DepartOriginActual = t₁`**.

3. Vessel **arrives** at destination; we **complete** trip *N* and **start** trip *N+1* on the **same** tick **`t₂`**: **`ArriveDestDockActual = t₂`**, **`EndTime = t₂`**.

4. **Trip *N+1*** on its **first** tick: **`StartTime = t₂`**, **`ArriveOriginDockActual = t₂`** — matching **`ArriveDestDockActual`** from trip *N* (chain invariant).

ML and projection use **Layer A** times for boundaries; **`StartTime`/`EndTime`** track **coverage** and **happen to align** with boundary ticks in this story — they are still **not** substitutes for **`dep-dock` / `arv-dock`** facts.

---

## 4. Single source of truth for *which* clock

All domain timestamps — **coverage** (`StartTime`, `EndTime`) and **physical boundaries** (`ArriveOriginDockActual`, `ArriveDestDockActual`, `DepartOriginActual` / legacy `LeftDockActual`) — use **feed observation time**: **`ConvexVesselLocation.TimeStamp`** (and the same notion on the trip row where we persist per-tick context) — **not** server wall clock (`Date.now()`) for lifecycle meaning.

Feed latency (e.g. 5–15s) is acceptable; **internal consistency** requires one coordinate system.

---

## 5. Happy path: one tick for “arrival at destination → complete → start next”

**Design rule:** On the canonical **arrival at destination dock** boundary, we **complete the current trip and start the next trip on the same tick**. Therefore there is **no** intentional split between “arrival stamped on tick T₁” and “completion on tick T₂” in the happy path: **one** `TimeStamp` applies to **`ArriveDestDockActual`**, **`EndTime`** (and any legacy completion field being replaced), and the **next** trip’s **`ArriveOriginDockActual`** / **`StartTime`** as defined for that transition.

If implementation ever separates those across ticks without an explicit non–happy-path reason, that is **out of line** with this contract.

---

## 6. Legacy field → new model (compact mapping)

This table is **conceptual**, not a literal rename spec. One legacy field often **split** into coverage vs physical actual depending on scenario.

| Legacy field        | New model (role) | Notes |
|---------------------|------------------|--------|
| **`TripStart`**     | Split | **Coverage / chain:** in the happy path, **often equals `StartTime`** when the row opens (see **Worked example**); **not** automatically **`ArriveOriginDockActual`**. **Physical:** only treat as origin arrival when the pipeline asserts it — otherwise **do not** use `TripStart` for ML/projection boundary facts. |
| **`AtDockActual`**  | Mostly **`StartTime`** / recording | **Not** a trusted **`ArriveOriginDockActual`**; today it mixes first-seen, carry-forward, and fallback. Prefer **coverage** semantics or drop as a physical dock field after refactor. |
| **`TripEnd`**       | **`EndTime`** + optional **`ArriveDestDockActual`** | **Coverage close:** **`EndTime`**. **Physical destination arrival:** **`ArriveDestDockActual`** when asserted; same tick as **`EndTime`** in happy path. |
| **`ArriveDest`**    | **`ArriveDestDockActual`** (`ArriveNextActual`) | Same role when trusted; align naming with **`ArriveOriginDockActual`**. |
| **`LeftDock` / `LeftDockActual`** | **`DepartOriginActual`** | **Physical leave origin**; keep first-class for **`dep-dock`** projection and ML until column rename. |
| **`TimeStamp` (on row)** | Per-tick feed cursor | Remains “latest observation”; not the same as **`StartTime`** / **`EndTime`** unless defined that way in schema. |

**Consumers:** Timeline **`eventsActual`** patches and ML features should use **Layer A** boundary actuals (and scheduled context) — **not** **`StartTime`/`EndTime`** — when emitting or interpreting **dep-dock** / **arv-dock**-style facts.

---

## 7. Intended outcome of the refactor

- **Clear names** for **coverage** vs **asserted physical boundaries** (arrivals **and** departure).
- **Fewer fields** doing double duty under misleading labels (`AtDockActual`-style overload).
- **Explicit handling** of cold start, warm start, and synthetic **`EndTime`** without conflating them with **`Arrive*`** / **departure** actuals.
- **Easier** correctness work later: map old fields to the new model, then tighten writers and readers — **after** this semantic standard is agreed and documented.

This memo is the **semantic baseline** for that standardization; implementation follows separately.
