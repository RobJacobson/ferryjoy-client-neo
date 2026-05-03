/**
 * Pure pipeline: vessel/day event row arrays → `VesselTimelineRenderState`
 * using the same merge, dock visits, spans, and axis mapping as route snapshot
 * assembly (without `RouteTimelineSnapshot`).
 */

import type { ConvexActualDockEvent } from "convex/functions/events/eventsActual/schemas";
import type { ConvexPredictedDockEvent } from "convex/functions/events/eventsPredicted/schemas";
import type { ConvexScheduledDockEvent } from "convex/functions/events/eventsScheduled/schemas";
import { buildDomainDockVisitsForVesselDay } from "domain/routeTimeline";
import type { TimelineVisualTheme } from "@/components/timeline/theme";
import { BASE_TIMELINE_VISUAL_THEME } from "@/components/timeline/theme";
import {
  deriveRouteTimelineAxisGeometry,
  selectDockVisitVisualSpans,
} from "@/features/RouteTimelineModel";
import type { VesselLocation } from "@/types";
import {
  DEFAULT_VESSEL_TIMELINE_LAYOUT,
  START_OF_DAY_DOCK_VISUAL_CAP_MINUTES,
} from "../config";
import type {
  VesselTimelineLayoutConfig,
  VesselTimelineRenderState,
} from "../types";
import {
  buildEmptyRenderState,
  buildVesselTimelineRenderStateFromAxisGeometry,
} from "./buildVesselTimelineRenderStateFromAxisGeometry";

type FromEventRowsArgs = {
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockEvent[];
  vesselAbbrev: string;
  sailingDay: string;
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null;
  vesselLocation?: VesselLocation | null;
  now?: Date;
  layout?: VesselTimelineLayoutConfig;
  theme?: TimelineVisualTheme;
};

/**
 * Builds vessel timeline render state from subscribed dock event rows for one
 * vessel and sailing day.
 *
 * @param args - Event row slices, scope, terminal lookup, and presentation
 * inputs
 * @returns Static render scaffold for the timeline renderer
 */
const fromEventRows = ({
  scheduledEvents,
  actualEvents,
  predictedEvents,
  vesselAbbrev,
  sailingDay,
  getTerminalNameByAbbrev,
  vesselLocation = null,
  now = new Date(),
  layout = DEFAULT_VESSEL_TIMELINE_LAYOUT,
  theme = BASE_TIMELINE_VISUAL_THEME,
}: FromEventRowsArgs): VesselTimelineRenderState => {
  const dockVisits = buildDomainDockVisitsForVesselDay({
    scheduledEvents,
    actualEvents,
    predictedEvents,
    vesselAbbrev,
    sailingDay,
  });

  if (dockVisits.length === 0) {
    return buildEmptyRenderState(layout, theme);
  }

  const spans = selectDockVisitVisualSpans(dockVisits);
  if (spans.length === 0) {
    return buildEmptyRenderState(layout, theme);
  }

  const axisGeometry = deriveRouteTimelineAxisGeometry(spans, {
    rowHeightBasePx: layout.rowHeightBasePx,
    rowHeightScalePx: layout.rowHeightScalePx,
    rowHeightExponent: layout.rowHeightExponent,
    minSpanHeightPx: layout.minRowHeightPx,
    startOfDayDockVisualCapMinutes: START_OF_DAY_DOCK_VISUAL_CAP_MINUTES,
  });

  return buildVesselTimelineRenderStateFromAxisGeometry({
    axisGeometry,
    getTerminalNameByAbbrev,
    vesselLocation,
    now,
    layout,
    theme,
  });
};

export type { FromEventRowsArgs };
export { fromEventRows };
