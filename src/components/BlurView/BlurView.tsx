/**
 * Native BlurView – wraps expo-blur in a clipping container for rounded corners.
 * UIVisualEffectView does not respect borderRadius; an inner wrapper uses overflow: hidden
 * so the blur is clipped. Shadow styles stay on the outer wrapper—same-view overflow would
 * clip the shadow.
 */

import { BlurView as ExpoBlurView } from "expo-blur";
import { StyleSheet } from "react-native";
import { View } from "@/components/ui";
import type { BlurViewProps } from "./BlurView.types";

/**
 * Native BlurView with rounded-corner clipping.
 * Wraps expo-blur in a View with overflow: hidden so the blur is clipped to border-radius.
 */
export const BlurView = (props: BlurViewProps) => {
  const { style, className, children, tint, ...rest } = props;
  // expo-blur has no "clear"; use thinnest material for minimal frosting.
  const nativeTint = tint === "clear" ? "systemUltraThinMaterial" : tint;

  return (
    <View style={[style, { overflow: "hidden" }]} className={className}>
      <ExpoBlurView {...rest} tint={nativeTint} style={StyleSheet.absoluteFill}>
        {children}
      </ExpoBlurView>
    </View>
  );
};
