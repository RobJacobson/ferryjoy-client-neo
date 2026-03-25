/**
 * Remount-key helpers for the VesselTimeline data host.
 */

/**
 * Stable remount key for one vessel/day query scope plus manual retry count.
 *
 * @param vesselAbbrev - Vessel abbreviation for the current scope
 * @param sailingDay - Sailing day for the current scope
 * @param retryNonce - Manual retry counter for remounting the subtree
 * @returns React subtree key for the provider boundary
 */
export const getVesselTimelineDataHostKey = (
  vesselAbbrev: string,
  sailingDay: string,
  retryNonce: number
) => `${vesselAbbrev}:${sailingDay}:${retryNonce}`;
