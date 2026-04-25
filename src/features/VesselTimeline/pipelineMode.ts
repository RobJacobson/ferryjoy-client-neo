/**
 * Temporary pipeline mode toggle for VesselTimeline route-model wiring.
 */

export const USE_ROUTE_TIMELINE_MODEL_PIPELINE = true;

export type VesselTimelinePipelineMode = "route-model" | "legacy-events";

/**
 * Resolve the active VesselTimeline pipeline mode.
 *
 * Defaults to the route-model pipeline while the temporary integration
 * constant is enabled and route scope is available.
 *
 * @param args - Pipeline mode resolution inputs
 * @param args.routeAbbrev - Optional route abbreviation for route-model data
 * @returns Selected pipeline mode
 */
export const resolveVesselTimelinePipelineMode = ({
  routeAbbrev,
  preferRouteModel = USE_ROUTE_TIMELINE_MODEL_PIPELINE,
}: {
  routeAbbrev?: string;
  preferRouteModel?: boolean;
}): VesselTimelinePipelineMode =>
  preferRouteModel && Boolean(routeAbbrev) ? "route-model" : "legacy-events";

/**
 * Determine whether the route-model default should wait for route scope.
 *
 * This prevents the temporary route-model default from briefly mounting the
 * legacy provider while live vessel locations are still resolving route abbrevs.
 *
 * @param args - Route-scope loading inputs
 * @param args.routeAbbrev - Optional resolved route abbreviation
 * @param args.isRouteScopeLoading - Whether route-scope source data is loading
 * @param args.preferRouteModel - Optional route-model preference override
 * @returns Whether the timeline should show loading while route scope resolves
 */
export const shouldWaitForVesselTimelineRouteScope = ({
  routeAbbrev,
  isRouteScopeLoading,
  preferRouteModel = USE_ROUTE_TIMELINE_MODEL_PIPELINE,
}: {
  routeAbbrev?: string;
  isRouteScopeLoading: boolean;
  preferRouteModel?: boolean;
}) => preferRouteModel && !routeAbbrev && isRouteScopeLoading;
