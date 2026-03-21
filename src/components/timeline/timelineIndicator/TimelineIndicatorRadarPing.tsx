import Animated from "react-native-reanimated";
import type { TimelineVisualTheme } from "../theme";
import { getTimelineIndicatorRadarPingStyle } from "./timelineIndicatorRadarPingConfig";

type TimelineIndicatorRadarPingProps = {
  sizePx: number;
  theme: TimelineVisualTheme;
};

export const TimelineIndicatorRadarPing = ({
  sizePx,
  theme,
}: TimelineIndicatorRadarPingProps) => {
  const pingStyle = getTimelineIndicatorRadarPingStyle(
    theme.indicator.ping,
    sizePx
  );

  return <Animated.View pointerEvents="none" style={pingStyle} />;
};
