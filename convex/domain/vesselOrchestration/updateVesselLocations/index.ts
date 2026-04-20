/**
 * Public entry for **updateVesselLocations**.
 *
 * Stage A freezes the plain-data contract here while the functions layer
 * continues to own external fetch and persistence sequencing.
 */

export type {
  RunUpdateVesselLocationsInput,
  RunUpdateVesselLocationsOutput,
  VesselLocationRow,
} from "./contracts";
export { computeVesselLocationRows } from "./computeVesselLocationRows";
