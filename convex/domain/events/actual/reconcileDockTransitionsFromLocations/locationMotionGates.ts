/**
 * Speed and dock-state predicates used by reconcile motion confirmation.
 *
 * Sensor noise near zero knots can flip the AtDock flag at the dock approach;
 * pairing dock state with explicit speed thresholds prevents reconcile from
 * confirming departures or arrivals on jitter alone.
 */

import type { ConvexVesselLocation } from "../../../../functions/vesselLocation/schemas";

const MOVING_SPEED_THRESHOLD = 0.2;
const DOCKED_SPEED_THRESHOLD = 0.2;

/**
 * True when speed indicates the vessel has left the dock environment.
 *
 * Uses MOVING_SPEED_THRESHOLD so light GPS jitter near zero knots does not
 * flip state. Pairs with strongArrival to bound state changes on both sides.
 *
 * @param location - Sample with AtDock and Speed fields
 * @returns True when AtDock is false and speed meets the movement threshold
 */
const strongDeparture = (location: ConvexVesselLocation) =>
  location.AtDock === false && location.Speed >= MOVING_SPEED_THRESHOLD;

/**
 * True when speed indicates the vessel has settled at the berth.
 *
 * DOCKED_SPEED_THRESHOLD pairs with strongDeparture to avoid ambiguous
 * mid-range speeds toggling reconcile decisions.
 *
 * @param location - Sample with AtDock and Speed fields
 * @returns True when AtDock is true and speed is below the docked threshold
 */
const strongArrival = (location: ConvexVesselLocation) =>
  location.AtDock === true && location.Speed < DOCKED_SPEED_THRESHOLD;

export { strongArrival, strongDeparture };
