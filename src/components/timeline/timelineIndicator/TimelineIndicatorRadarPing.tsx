import Animated from "react-native-reanimated";
import {
  DEFAULT_TIMELINE_INDICATOR_RADAR_PING_VARIANT,
  getTimelineIndicatorRadarPingLayerStyles,
  type TimelineIndicatorRadarPingVariant,
} from "./timelineIndicatorRadarPingConfig";

type TimelineIndicatorRadarPingProps = {
  sizePx: number;
  variant?: TimelineIndicatorRadarPingVariant;
};

export const TimelineIndicatorRadarPing = ({
  sizePx,
  variant = DEFAULT_TIMELINE_INDICATOR_RADAR_PING_VARIANT,
}: TimelineIndicatorRadarPingProps) => {
  const layerStyles = getTimelineIndicatorRadarPingLayerStyles(variant, sizePx);

  return (
    <>
      {layerStyles.map(({ key, style }) => (
        <Animated.View
          key={`${variant}-${key}`}
          pointerEvents="none"
          style={style}
        />
      ))}
    </>
  );
};
