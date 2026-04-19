/**
 * **updateVesselTimeline**: mutation argument objects for `eventsActual` /
 * `eventsPredicted` from a tick projection.
 */

import type { TimelineTickProjectionInput } from "./tickEventWrites";

export const timelineDockWriteMutationArgs = (
  tl: TimelineTickProjectionInput
): {
  actual: { Writes: TimelineTickProjectionInput["actualDockWrites"] };
  predicted: {
    Batches: TimelineTickProjectionInput["predictedDockWriteBatches"];
  };
} => ({
  actual: { Writes: tl.actualDockWrites },
  predicted: { Batches: tl.predictedDockWriteBatches },
});
