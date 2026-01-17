import { ProgressiveBlurView } from "@sbaiahmed1/react-native-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Layout information passed to render prop children.
 */
export type GlassHeaderLayout = {
  /** Total overlay height (safe area + nav). */
  contentInsetTop: number;
  /** Safe area inset at the top (notch/status bar). */
  safeAreaTop: number;
  /** The nav/header portion below the safe area inset. */
  navBarHeight: number;
};

/**
 * Props for the GlassHeader component.
 */
export interface GlassHeaderProps {
  /**
   * If you pass a function, you get `contentInsetTop` for ScrollView padding.
   * If you pass a node, it's rendered as-is.
   */
  children: React.ReactNode | ((layout: GlassHeaderLayout) => React.ReactNode);

  /** Height of the header area below the notch/status bar. */
  navBarHeight?: number;

  /** Style for the page container. */
  style?: StyleProp<ViewStyle>;

  /** Tint color for the glass effect (defaults to white with transparency). */
  tintColor?: string;

  /** Glass effect style - only applies on iOS 26+. */
  glassEffectStyle?: "regular" | "clear";

  /** Enable progressive blur effect for content entering the header area. */
  enableProgressiveBlur?: boolean;

  /** Blur intensity for progressive blur (0-100). Only applies when enableProgressiveBlur is true. */
  blurIntensity?: number;
}

/**
 * Modern glass header component using Expo's native liquid glass effect.
 *
 * This component provides:
 * 1. Native iOS 26 liquid glass effect when available
 * 2. Progressive blur effect that blurs content as it enters the header area
 * 3. Graceful fallbacks for older platforms
 * 4. Automatic contentInsetTop calculation for proper scroll view padding
 * 5. Same API as the legacy BlurPage component for easy migration
 *
 * On iOS 26+: Uses native UIVisualEffectView for authentic liquid glass + ProgressiveBlurView for blur
 * Progressive blur: Creates gradient blur where content blurs progressively toward the top
 * Older platforms: Falls back to solid tint with progressive blur simulation
 */
export const GlassHeader: React.FC<GlassHeaderProps> = ({
  children,
  navBarHeight = 56,
  style,
  tintColor = "rgba(255, 255, 255, 0.8)",
  glassEffectStyle = "regular",
  enableProgressiveBlur = true,
  blurIntensity = 20,
}) => {
  const insets = useSafeAreaInsets();
  const contentInsetTop = insets.top + navBarHeight;

  const hasLiquidGlass = isLiquidGlassAvailable();

  return (
    <View className="flex-1" style={style}>
      {/* Glass header overlay with progressive blur */}
      <View
        pointerEvents="none"
        className="absolute left-0 right-0"
        style={{
          top: 0,
          height: contentInsetTop,
          zIndex: 1000,
        }}
      >
        {enableProgressiveBlur ? (
          <ProgressiveBlurGlass
            height={contentInsetTop}
            tintColor={tintColor}
            glassEffectStyle={glassEffectStyle}
            blurIntensity={blurIntensity}
            hasLiquidGlass={hasLiquidGlass}
          />
        ) : // Simple glass effect without progressive blur
        hasLiquidGlass ? (
          <GlassView
            glassEffectStyle={glassEffectStyle}
            tintColor={tintColor}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
        ) : (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: tintColor,
            }}
          />
        )}
      </View>

      {/* Content */}
      {typeof children === "function"
        ? children({
            contentInsetTop,
            safeAreaTop: insets.top,
            navBarHeight,
          })
        : children}
    </View>
  );
};

/**
 * Progressive blur glass component combining native liquid glass with progressive blur.
 * Creates a gradient blur effect where content blurs progressively as it enters the header area.
 */
const ProgressiveBlurGlass: React.FC<{
  height: number;
  tintColor: string;
  glassEffectStyle: "regular" | "clear";
  blurIntensity: number;
  hasLiquidGlass: boolean;
}> = ({
  tintColor,
  glassEffectStyle,
  blurIntensity,
  hasLiquidGlass,
}) => {
  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Progressive blur layer - creates the gradient blur effect */}
      <ProgressiveBlurView
        blurType="light"
        blurAmount={blurIntensity}
        direction="blurredTopClearBottom"
        startOffset={0}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />

      {/* Glass effect overlay - adds liquid glass on iOS 26+ */}
      {hasLiquidGlass ? (
        <GlassView
          glassEffectStyle={glassEffectStyle}
          tintColor={tintColor}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      ) : (
        // Fallback tint for older platforms
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: tintColor,
          }}
        />
      )}
    </View>
  );
};
