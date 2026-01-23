## ML notes: replacing `meanAtDockDuration` with “slack needed to be on time”

This document summarizes a proposed improvement to the ML “schedule pressure”
prior used for regime classification and related features.

### Background

Today we use `meanAtDockDuration[Curr->Next]` as a proxy for “typical turnaround
time” at `Curr` before departing to `Next`.

However, `meanAtDockDuration` is computed from historical WSF data as the mean
minutes between:

- **Arrival-at-dock proxy**: WSF `EstArrival` (see `readme-ml.md`)
- **Actual departure**: WSF `ActualDepart` / `LeftDock`

On some routes (especially San Juans), schedules include intentional slack.
Vessels may arrive early and wait, which inflates the mean “at dock” duration.
This can overstate operational turnaround needs.

The ML intent is not “mean dwell time,” but:

- **How much time does the vessel typically need to still depart on time?**

### Existing relevant concepts in code

- **Slack at Curr (available at arrival time)**:
  - `slackBeforeDepartureMinutes = max(0, scheduledDepart - arrivalAtCurr)`
- **Departure delay label**:
  - `tripDelayMinutes = actualDepart - scheduledDepart`
- **Pressure feature today**:
  - Computed as `max(0, threshold - slack)` where `threshold` is derived from
    `meanAtDockDuration`
  - Note: there are two slightly different formulas in the codebase today:
    - `shared/features.ts` uses `1.5 * meanAtDockDuration`
    - `shared/featureRecord.ts` uses `meanAtDockDuration`
  - (We should reconcile these when implementing any change.)

### Proposed simpler alternative (Option B)

Replace the prior “mean turnaround dwell” with a prior that directly matches the
intent:

- **On-time definition**: depart within **2 minutes** of schedule:
  - `onTime = (tripDelayMinutes <= 2)`
- **Target probability**: **0.9**
- **New prior table**:
  - `slackNeededP90OnTimeMinutes[Curr->Next] = s*`
  - where `s*` is the smallest slack such that:
    - `P(onTime | slack = s*) >= 0.9`

This yields a route-specific number like:

- “This route typically needs ~10 minutes of slack to be on time 90% of the
  time,”

instead of:

- “The vessel spends ~30 minutes at dock on average,” which can include waiting.

### How to compute it (precomputed before training)

Compute this as part of the same preprocessing that computes route priors (using
the same historical date window as training).

For each historical sample where we can compute:

- `arrivalAtCurr` (arrival proxy at Curr, typically previous leg `EstArrival`)
- `scheduledDepartCurr`
- `actualDepartCurr`

Compute:

- `slackMinutes = max(0, minutesBetween(arrivalAtCurr, scheduledDepartCurr))`
- `tripDelayMinutes = minutesBetween(scheduledDepartCurr, actualDepartCurr)`
- `onTime = (tripDelayMinutes <= 2)`

Then, per route pair `Curr->Next`, estimate:

- `p(s) = P(onTime | slackMinutes = s)`

#### Practical estimator (robust, low complexity)

- Bin slack into **2-minute bins** in range 0..120 minutes.
  - Cap slack > 120 into the 120 bin.
- For each bin:
  - `rate = onTimeCount / totalCount`
- Apply **monotone smoothing** so the on-time rate is non-decreasing with slack:
  - Isotonic regression is preferred, but a simple fallback is:
    - compute cumulative `rate(s)` for all samples with `slack <= s`
    - take a running max
- Choose:
  - `s* = smallest bin start where smoothedRate >= 0.9`
- Store:
  - `slackNeededP90OnTimeMinutes[Curr->Next] = s*`

### Guardrails / fallbacks

- **Minimum samples per route**: if fewer than (suggested) 200 samples, fallback
  to a safe default (global default, or existing `meanAtDockDuration`).
- **Never reaches 0.9** by 120 minutes: set `s* = 120` and/or flag route as
  unreliable (or fallback).
- **Always on time**: `s* = 0` is valid.

### How it would be used in features / regime

Once computed, replace/augment the current “pressure” feature to use the new
prior:

- `pressure = max(0, slackNeededP90OnTimeMinutes - slackBeforeDepartureMinutes)`

This preserves the same intuitive shape:

- Plenty of slack → pressure ≈ 0
- Not enough slack → pressure increases

Optionally, the layover vs in-service regime threshold can later be expressed in
terms of `slackNeededP90OnTimeMinutes` (e.g. `slack > k * slackNeededP90`), but
the initial change can be just swapping the prior in the pressure feature.

