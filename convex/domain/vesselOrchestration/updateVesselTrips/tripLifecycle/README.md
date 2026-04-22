# tripLifecycle (updateVesselTrips)

Low-level helpers that still support the pure trip-update pipeline: event
detection, base trip construction, and completion shaping. Trip-field
inference from schedule evidence lives in [`../tripFields/`](../tripFields/);
these helpers consume locations that were already prepared with provisional
trip fields when needed.

See [`../README.md`](../README.md) and [`../../architecture.md`](../../architecture.md).
