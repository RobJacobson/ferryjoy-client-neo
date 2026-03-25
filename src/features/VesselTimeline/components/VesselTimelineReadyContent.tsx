/**
 * Ready-state content for the VesselTimeline feature.
 */

import type { TimelineVisualTheme } from "@/components/timeline";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
  VesselTimelineSegment,
} from "@/data/contexts";
import { useNowMs } from "@/shared/hooks";
import { TimelineContent } from "./TimelineContent";
import { getVesselTimelineRenderState } from "../utils";

export type VesselTimelineReadyContentProps = {
  now: Date;
  theme: TimelineVisualTheme;
  segments: VesselTimelineSegment[];
  liveState: VesselTimelineLiveState | null;
  activeState: VesselTimelineActiveState | null;
};

/**
 * Uses a ticking wall clock and renders the ready timeline state.
 *
 * @param props - Ready-state props without an explicit `now`
 * @returns Rendered timeline that updates once per second
 */
export const VesselTimelineLiveReadyContent = ({
  theme,
  segments,
  liveState,
  activeState,
}: Omit<VesselTimelineReadyContentProps, "now">) => {
  const nowMs = useNowMs(1000);

  return (
    <VesselTimelineReadyContent
      now={new Date(nowMs)}
      theme={theme}
      segments={segments}
      liveState={liveState}
      activeState={activeState}
    />
  );
};

/**
 * Builds render state from the loaded vessel/day timeline data and renders the
 * scrollable timeline view.
 *
 * @param props - Ready-state props
 * @param props.now - Current wall clock used for indicator state
 * @returns Fully rendered vessel timeline
 */
export const VesselTimelineReadyContent = ({
  now,
  theme,
  segments,
  liveState,
  activeState,
}: VesselTimelineReadyContentProps) => {
  const renderState = getVesselTimelineRenderState(
    segments,
    liveState,
    activeState,
    now,
    undefined,
    theme
  );

  return <TimelineContent {...renderState} />;
};
