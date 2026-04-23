/**
 * Public entry for **updateVesselTrips**.
 *
 * The supported public surface is intentionally small: one pure runner and its
 * input/output contract. Per-vessel seams and storage helpers stay on direct
 * file imports so `tripFields/` remains the obvious owner of trip-field
 * inference internals.
 */

export { computeVesselTripsRows } from "./computeVesselTripsRows";
export type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
} from "./types";
