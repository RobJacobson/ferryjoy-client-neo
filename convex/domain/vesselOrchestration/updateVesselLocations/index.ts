/**
 * Public entry for vessel-location normalization.
 *
 * The functions layer owns external fetch and persistence sequencing; this
 * folder exposes raw-feed mapping and mutation-side AtDockObserved enrichment.
 */

export { addAtDockObserved as withAtDockObserved } from "./addAtDockObserved";
export { mapWsfVesselLocations } from "./mapWsfVesselLocations";
