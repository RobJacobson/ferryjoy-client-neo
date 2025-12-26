import MaskedView from "@react-native-masked-view/masked-view";
import { ProgressiveBlurView } from "@sbaiahmed1/react-native-blur";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { hexToRgba } from "./utils";

export type RenderProps = {
  tintColor: string;
  opacity: number;
  fadeStartClamped: number;
  blurAmount: number;
  blurType: "light" | "dark" | "xlight" | "extraDark";
  blurDirection: "blurredTopClearBottom" | "blurredBottomClearTop";
  blurStartOffset: number;
  height: number;
  position: "top" | "bottom";
  hasBlur: boolean;
  useMaskedFade: boolean;
};

export const renderReducedTransparencyMode = ({
  tintColor,
  opacity,
}: Pick<RenderProps, "tintColor" | "opacity">) => (
  <View
    className="absolute inset-0"
    style={{ backgroundColor: hexToRgba(tintColor, Math.max(opacity, 0.9)) }}
  />
);

export const renderWebMode = ({
  tintColor,
  opacity,
  fadeStartClamped,
}: Pick<RenderProps, "tintColor" | "opacity" | "fadeStartClamped">) => {
  // Web doesn't support ProgressiveBlurView, so we only render opacity gradient
  const startOpacity = 1;
  const endOpacity = 0;
  const fadeStartPercent = fadeStartClamped * 100;

  const smoothGradient = `linear-gradient(to bottom,
    rgba(0,0,0,${startOpacity}) 0%,
    rgba(0,0,0,${startOpacity}) ${fadeStartPercent}%,
    rgba(0,0,0,${endOpacity}) 100%)`;

  return (
    <View
      className="absolute inset-0"
      style={{
        backgroundColor: hexToRgba(tintColor, opacity),
        ...({
          maskImage: smoothGradient,
          WebkitMaskImage: smoothGradient,
        } as const satisfies Record<string, string>),
      }}
    />
  );
};

const renderMaskedMode = ({
  tintColor,
  opacity,
  fadeStartClamped,
}: Pick<RenderProps, "tintColor" | "opacity" | "fadeStartClamped">) => {
  // Create the opacity mask element
  const startOpacity = 1;
  const endOpacity = 0;

  const maskElement = (
    <View className="absolute inset-0 bg-transparent">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="opacityMask" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={startOpacity} />
            <Stop
              offset={String(fadeStartClamped)}
              stopColor="#fff"
              stopOpacity={startOpacity}
            />
            <Stop offset="1" stopColor="#fff" stopOpacity={endOpacity} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#opacityMask)" />
      </Svg>
    </View>
  );

  return (
    <MaskedView style={StyleSheet.absoluteFill} maskElement={maskElement}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: hexToRgba(tintColor, opacity) },
        ]}
      />
    </MaskedView>
  );
};

const renderCombinedBlurMode = ({
  tintColor,
  opacity,
  fadeStartClamped,
  blurAmount,
  blurType,
  blurDirection,
  blurStartOffset,
}: Pick<
  RenderProps,
  | "tintColor"
  | "opacity"
  | "fadeStartClamped"
  | "blurAmount"
  | "blurType"
  | "blurDirection"
  | "blurStartOffset"
>) => {
  // Create the opacity mask for the tint overlay
  const startOpacity = 1;
  const endOpacity = 0;

  const opacityMaskElement = (
    <View className="absolute inset-0 bg-transparent">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="opacityMask" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={startOpacity} />
            <Stop
              offset={String(fadeStartClamped)}
              stopColor="#fff"
              stopOpacity={startOpacity}
            />
            <Stop offset="1" stopColor="#fff" stopOpacity={endOpacity} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#opacityMask)" />
      </Svg>
    </View>
  );

  return (
    <View className="absolute inset-0">
      {/* Progressive blur layer - this creates the gradient blur effect */}
      <ProgressiveBlurView
        blurType={blurType}
        blurAmount={blurAmount}
        direction={blurDirection}
        startOffset={blurStartOffset}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Opacity tint overlay - this adds the color tint with gradient fade */}
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={opacityMaskElement}
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: hexToRgba(tintColor, opacity) },
          ]}
        />
      </MaskedView>
    </View>
  );
};

const renderFallbackMode = ({
  tintColor,
  opacity,
}: Pick<RenderProps, "tintColor" | "opacity">) => (
  <View
    className="absolute inset-0"
    style={{
      backgroundColor: hexToRgba(tintColor, opacity),
    }}
  />
);

export const renderBlurOverlay = (renderProps: RenderProps) => {
  const {
    tintColor,
    opacity,
    fadeStartClamped,
    blurAmount,
    blurType,
    blurDirection,
    blurStartOffset,
    hasBlur,
    useMaskedFade,
  } = renderProps;

  if (hasBlur && useMaskedFade) {
    return renderCombinedBlurMode({
      tintColor,
      opacity,
      fadeStartClamped,
      blurAmount,
      blurType,
      blurDirection,
      blurStartOffset,
    });
  }

  if (useMaskedFade) {
    return renderMaskedMode({
      tintColor,
      opacity,
      fadeStartClamped,
    });
  }

  return renderFallbackMode({
    tintColor,
    opacity,
  });
};
