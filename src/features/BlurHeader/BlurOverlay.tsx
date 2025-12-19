import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  renderBlurOverlay,
  renderReducedTransparencyMode,
  renderWebMode,
} from "./blurRenderers";
import { type BlurOverlayProps, useBlurOverlaySetup } from "./utils";

export type { BlurOverlayProps };

/**
 * Unified blur overlay that combines both opacity and progressive blur gradients.
 *
 * This component creates an iOS 26 Contacts-style header with:
 * 1. Progressive blur gradient (content becomes more blurry as it scrolls up) - optional
 * 2. Progressive opacity gradient (tint fades out as it approaches content)
 *
 * When blurAmount is 0, only opacity gradient is applied.
 * When blurAmount > 0, both blur and opacity gradients are combined.
 */
export const BlurOverlay: React.FC<BlurOverlayProps> = (props) => {
  const insets = useSafeAreaInsets();

  const {
    position,
    height,
    extendIntoNotch,
    tintColor,
    opacity,
    fadeStartClamped,
    blurAmount,
    blurType,
    blurDirection,
    blurStartOffset,
    zIndex,
    style,
    reduceTransparencyEnabled,
    hasBlur,
    useMaskedFade,
  } = useBlurOverlaySetup(props);

  const isTop = position === "top";
  const defaultInsetHeight = isTop ? insets.top : insets.bottom;

  const resolvedHeight = height ?? defaultInsetHeight;
  if (!resolvedHeight || resolvedHeight <= 0) {
    console.warn(
      "BlurOverlay: Invalid height provided, component will not render"
    );
    return null;
  }

  const resolvedExtendIntoNotch = extendIntoNotch ?? position === "top";

  const top = isTop ? (resolvedExtendIntoNotch ? 0 : insets.top) : undefined;
  const bottom = !isTop ? 0 : undefined;

  const heightResolved = resolvedHeight;

  const renderProps = {
    tintColor,
    opacity,
    fadeStartClamped,
    blurAmount,
    blurType,
    blurDirection,
    blurStartOffset,
    height: heightResolved,
    position,
    hasBlur,
    useMaskedFade,
  };

  return (
    <View
      pointerEvents="none"
      className="absolute left-0 right-0"
      style={[
        {
          top,
          bottom,
          height: resolvedHeight,
          zIndex,
        },
        style,
      ]}
    >
      {reduceTransparencyEnabled
        ? renderReducedTransparencyMode({ tintColor, opacity })
        : Platform.OS === "web"
          ? renderWebMode({
              tintColor,
              opacity,
              fadeStartClamped,
            })
          : renderBlurOverlay(renderProps)}
    </View>
  );
};
