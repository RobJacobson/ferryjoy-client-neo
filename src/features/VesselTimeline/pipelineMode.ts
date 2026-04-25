/**
 * Determine whether the route-model default should wait for route scope.
 *
 * This prevents the timeline from querying with missing route scope while
 * live vessel locations are still resolving route abbrevs.
 *
 * @param args - Route-scope loading inputs
 * @param args.routeAbbrev - Optional resolved route abbreviation
 * @param args.isRouteScopeLoading - Whether route-scope source data is loading
 * @returns Whether the timeline should show loading while route scope resolves
 */
export const shouldWaitForVesselTimelineRouteScope = ({
  routeAbbrev,
  isRouteScopeLoading,
}: {
  routeAbbrev?: string;
  isRouteScopeLoading: boolean;
}) => !routeAbbrev && isRouteScopeLoading;
