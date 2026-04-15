/**
 * Removes in-memory ML prediction blobs before persisting vessel trip rows.
 *
 * Re-exports domain-owned storage shaping; see `domain/vesselTrips/tripLifecycle/stripTripPredictionsForStorage`.
 */

export { stripTripPredictionsForStorage } from "domain/vesselTrips/tripLifecycle/stripTripPredictionsForStorage";
