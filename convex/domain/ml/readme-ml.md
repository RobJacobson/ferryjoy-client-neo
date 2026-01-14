# FerryJoy ML v2 — Vessel Schedule Prediction Models

This document describes **ML v2**, a windowed, regime-aware set of linear models that predict vessel departure/arrival timing across two consecutive legs. The system is designed to behave correctly in two operational regimes:

- **In Service**: the vessel has just arrived at B from A and is performing a normal turnaround.
- **Layover**: the vessel has been at dock at B for an extended period (e.g., overnight), so prior-leg context is intentionally ignored.

ML v2 currently focuses on **training** and model storage. Integration into real-time prediction flows is intentionally deferred.

---

## Glossary (A→B→C)

We assume two consecutive trips:

- **prev** leg: **A→B**
- **curr** leg: **B→C**

Some models require a third observed leg:

- **next** leg: **C→D** (only to train “depart from C” / **Depart-Next** targets)

We also distinguish “state” at prediction time:

- **at dock**: the vessel is at B and has not departed B yet
- **at sea**: the vessel has departed B and is en route to C

All targets are in **signed minutes** (negative is allowed but should be rare).

---

## The 10 model types (what each predicts)

We train **ten** multivariate linear regression models:
- 5 for **in-service**
- 5 for **layover**

Model keys (canonical list) live in:
- `convex/domain/ml/v2/shared/types.ts` (`MODEL_KEYS_V2`)

### In-service models (bucket by A→B→C)

In-service models explicitly use A→B context and bucket by the **chain key**:
- `A->B->C`

1) **`in-service-at-dock-depart-b`**
- **Use when**: at dock at B
- **Predicts**: expected departure from B, measured as minutes from **B scheduled departure**
- **Target**: \( \Delta(B\_{schedDepart},\ B\_{actualDepart}) \)

2) **`in-service-at-dock-arrive-c`**
- **Use when**: at dock at B
- **Predicts**: expected arrival at C, measured as minutes from **B scheduled departure**
- **Target**: \( \Delta(B\_{schedDepart},\ C\_{arrivalProxy}) \)

3) **`in-service-at-dock-depart-c`**
- **Use when**: at dock at B, and we have a reliable next leg out of C (C→D) to learn “depart C”
- **Predicts**: expected departure from C, measured as minutes from **C scheduled departure**
- **Target**: \( \Delta(C\_{schedDepart},\ C\_{actualDepart}) \)

4) **`in-service-at-sea-arrive-c`**
- **Use when**: at sea between B and C (B actual departure is known)
- **Predicts**: expected arrival at C, measured as minutes from **B actual departure**
- **Target**: \( \Delta(B\_{actualDepart},\ C\_{arrivalProxy}) \)

5) **`in-service-at-sea-depart-c`**
- **Use when**: at sea between B and C, and we have a reliable C→D leg
- **Predicts**: expected departure from C, measured as minutes from **C scheduled departure**
- **Target**: \( \Delta(C\_{schedDepart},\ C\_{actualDepart}) \)

### Layover models (bucket by B→C, ignore A entirely)

Layover models assume a “fresh start” and bucket only by the **pair key**:
- `B->C`

6) **`layover-at-dock-depart-b`**
- **Use when**: at dock at B under layover regime
- **Predicts**: departure delay from B, measured as minutes from **B scheduled departure**
- **Target**: \( \Delta(B\_{schedDepart},\ B\_{actualDepart}) \)

7) **`layover-at-dock-arrive-c`**
- **Use when**: at dock at B under layover regime
- **Predicts**: expected arrival at C, measured as minutes from **B scheduled departure**
- **Target**: \( \Delta(B\_{schedDepart},\ C\_{arrivalProxy}) \)

8) **`layover-at-dock-depart-c`**
- **Use when**: at dock at B under layover regime, and we have a reliable C→D leg
- **Predicts**: expected departure from C, measured as minutes from **C scheduled departure**
- **Target**: \( \Delta(C\_{schedDepart},\ C\_{actualDepart}) \)

9) **`layover-at-sea-arrive-c`**
- **Use when**: at sea between B and C under layover regime
- **Predicts**: expected arrival at C, measured as minutes from **B actual departure**
- **Target**: \( \Delta(B\_{actualDepart},\ C\_{arrivalProxy}) \)

10) **`layover-at-sea-depart-c`**
- **Use when**: at sea between B and C under layover regime, and we have a reliable C→D leg
- **Predicts**: expected departure from C, measured as minutes from **C scheduled departure**
- **Target**: \( \Delta(C\_{schedDepart},\ C\_{actualDepart}) \)

---

## Regime assignment: in-service vs layover

Regime is decided at terminal **B** for the upcoming leg **B→C**, based on how long the vessel has been at dock relative to expected turnaround.

### Arrival time proxy
WSF historical records do not provide a true “arrived at dock” timestamp. ML v2 uses:
- `EstArrival` as a **proxy** for arrival time (generally within ~1 minute of reality, with noise).

This proxy is used both in training targets/features and in regime assignment.

### Slack at B
Let:
- `arrivalB = prev.EstArrival` (proxy)
- `schedDepartB = curr.ScheduledDepart`

Then:

- \( slackB = \max(0,\ \Delta(arrivalB,\ schedDepartB)) \)

### Mean turnaround reference
We use route priors from:
- `convex/domain/ml/shared/config.ts`

Specifically:
- `meanAtDock(B->C)` (from the `meanAtDockDuration` table)

### Regime rule
- **In Service** if \( slackB \le 1.5 \times meanAtDock(B\to C) \)
- **Layover** if \( slackB > 1.5 \times meanAtDock(B\to C) \)

### Maintenance/out-of-service guardrail
To avoid training on “return from maintenance / out of service” events, we exclude windows where:
- \( slackB > 12\ hours \)

This preserves “overnight” while avoiding multi-day gaps.

Implementation:
- `convex/domain/ml/v2/training/data/createTrainingWindows.ts`

---

## Depart-Next training eligibility (avoid “overnight at C” contamination)

“Depart C” targets require observing a **next** leg out of C (C→D), but we must avoid learning from cases where the vessel arrives at C, sits overnight, and departs much later.

Eligibility is computed at **C** (independent of B’s regime).

Let:
- `arrivalC = curr.EstArrival` (proxy)
- `schedDepartC = next.ScheduledDepart` (from C→D)

Then:

- \( slackC = \max(0,\ \Delta(arrivalC,\ schedDepartC)) \)

We require:
- \( slackC \le 1.5 \times meanAtDock(C\to D) \)
- and \( slackC \le 12\ hours \)

If a window fails this eligibility test:
- it is still usable for **depart-curr** and **arrive-next** models
- it is **not** usable for **depart-next** models

Implementation:
- `convex/domain/ml/v2/training/data/createTrainingWindows.ts`

---

## Bucketing (critical architecture detail)

### In-service buckets: A→B→C chain keys
In-service models are bucketized by chain:
- `chainKey = A->B->C`

Rationale: A affects B timing (arrival pressure, delay propagation, differing travel times A→B).

### Layover buckets: B→C pair keys only
Layover models are bucketized by pair:
- `pairKey = B->C`

Rationale: under layover, A is intentionally ignored to avoid leaking stale context into “fresh start” predictions.

Implementation:
- `convex/domain/ml/v2/training/data/createTrainingBuckets.ts`

Sampling:
- each bucket is sampled to the **most recent** `config.getMaxSamplesPerRoute()` windows.

---

## Feature engineering (exactly what goes into models)

All ML v2 models are linear regressions over numeric features.

### Time features (scheduled-departure anchored)
We reuse v1’s time encoding:
- `extractTimeFeatures` from `convex/domain/ml/shared/features.ts`
  - Gaussian radial basis functions across time-of-day
- weekend indicator (0/1) derived from scheduled departure’s Pacific day-of-week

Anchors:
- For “depart-curr” / “arrive-next” models: time features are anchored to **B scheduled departure** (`curr.ScheduledDepart`).
- For “depart-next” models: we also include time features anchored to **C scheduled departure** (`next.ScheduledDepart`) when available, and keep separate weekend flags:
  - `isWeekendB`
  - `isWeekendC`

### Slack feature at B (both regimes)
- `slackBeforeCurrScheduledDepartMinutes` (computed from arrival proxy at B vs B scheduled depart)

This drives both regime-like behavior and “schedule anchoring” magnitude.

### Route priors for current leg (both regimes)
- `meanAtSeaCurrMinutes = meanAtSea(B->C)`
- `meanAtDockCurrMinutes = meanAtDock(B->C)`

Means are pulled from:
- `convex/domain/ml/shared/config.ts`

### In-service-only previous-leg context (A→B)
In-service models include:
- `prevTripDelayMinutes = Δ(A_sched_depart, A_actual_depart)`
- `prevAtSeaDurationMinutes = Δ(A_actual_depart, arrivalB_proxy)`
- `arrivalVsEstimatedScheduleMinutes`
  - estimated arrival at B = `A_sched_depart + meanAtSea(A->B)`
  - \( \Delta(estimatedArrivalB,\ arrivalB\_proxy) \)
- `arrivalAfterEstimatedScheduleMinutes = max(0, arrivalVsEstimatedScheduleMinutes)`
- `arrivalBeforeEstimatedScheduleMinutes = max(0, -arrivalVsEstimatedScheduleMinutes)`

Layover models do **not** include any A-derived features.

### At-sea-only current-leg realized context (B→C)
At-sea models include features that are only known once the vessel has departed B:
- `currTripDelayMinutes = Δ(B_sched_depart, B_actual_depart)`
- `currAtDockDurationMinutes = Δ(arrivalB_proxy, B_actual_depart)`

These provide the “refinement” capability once B actual departure is known.

### Feature definitions per model
Model definitions live in:
- `convex/domain/ml/v2/shared/models.ts`

Each model defines:
- `extractFeatures(window) -> Record<string, number>`
- `calculateTarget(window) -> number | null` (null = not trainable from that window)

---

## Training data construction (windowed)

ML v2 is trained from **per-vessel chronological windows** built from WSF history records.

### Required raw fields
To create windows, the current implementation requires per trip:
- `ScheduledDepart`
- `ActualDepart`
- `EstArrival` (arrival proxy)
- plus terminal names (mapped to abbrevs)

Continuity checks:
- A→B then B→C requires `prev.arriving === curr.departing`
- C→D (optional) requires `next.departing === curr.arriving`

Implementation:
- `convex/domain/ml/v2/training/data/createTrainingWindows.ts`

---

## Training algorithm (linear regression + time split)

### Model form
Each model is trained as:

- \( y = intercept + \sum_i coefficient_i \times x_i \)

### Train/test split
For each bucket and model type:
- 80/20 split using the bucket’s ordered windows (bucket sampling is most-recent-first)
- models are skipped if there are insufficient usable examples after filtering (especially depart-next)

### Feature ordering (critical)
Linear regression requires stable feature ordering. We store:
- `featureKeys` as a sorted list of feature names
- `coefficients` aligned to that ordering

At inference time, inputs must be vectorized with the same ordering.

### Numerical stability safeguard
If training produces unstable coefficients (e.g., very large magnitudes, NaNs), we fall back to a baseline:
- coefficients set to 0
- intercept set to the mean of `y_train`

Implementation:
- `convex/domain/ml/v2/training/models/trainModels.ts`

---

## Model storage (Convex)

ML v2 models are stored in the `modelParametersV2` table with:
- `bucketType`: `"chain"` or `"pair"`
- `chainKey` or `pairKey`
- `modelType`: one of the ten model keys
- `featureKeys`, `coefficients`, `intercept`
- `testMetrics` (MAE, RMSE, R²)
- `bucketStats` (totalRecords, sampledRecords)
- `createdAt`

Schemas/DB:
- `convex/functions/predictionsV2/schemas.ts`
- `convex/schema.ts`

---

## How to run ML v2

### Train v2 models and export v2 CSV

```bash
npm run train:ml:v2
```

### Export v2 CSV only

```bash
npm run train:export-results:v2
```

Output:
- `ml/training-results-v2.csv`

Export script:
- `scripts/export-training-results-v2-from-convex.ts`

---

## Integration notes (future)

### PrevTerminalAbbrev must represent A (not B)
ML v2’s in-service chain bucketing depends on knowing A (the previous trip’s departing terminal).

We corrected a bug where `PrevTerminalAbbrev` was incorrectly set to the previous trip’s arrival (B) instead of its departure (A). Any future prediction integration should preserve this semantic meaning so that A→B→C bucketing and A→B context features remain correct.

### Arrival proxy noise
Since `EstArrival` is a proxy, models will inherit noise in:
- slack calculations
- “arrival vs estimated schedule” features
- arrival targets

This is expected, but should be monitored when evaluating error distributions.

### Negative predictions
Targets are signed minutes; early departures are rare but allowed.
In production inference, strongly negative predictions should be treated as a safety signal and clamped/fallback if needed.

---

## File structure (v2)

```
convex/domain/ml/
├── readme-ml.md                      # This documentation (v2-focused)
├── shared/                           # Shared config + time feature utilities (used by v2)
└── v2/
    ├── index.ts
    ├── shared/
    │   ├── types.ts                  # TrainingWindow union + ModelTypeV2 keys
    │   └── models.ts                 # v2 model registry (features + targets)
    └── training/
        ├── actions.ts
        ├── pipeline.ts
        ├── data/
        │   ├── createTrainingWindows.ts
        │   └── createTrainingBuckets.ts
        └── models/
            ├── trainModels.ts
            └── storeModels.ts
```

Convex functions for storage/queries:

```
convex/functions/predictionsV2/
├── schemas.ts
├── mutations.ts
└── queries.ts
```

