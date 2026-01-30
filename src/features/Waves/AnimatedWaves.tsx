// ============================================================================
// Animated Waves Component
// ============================================================================
// Renders a layered stack of animated waves with varying properties
// Creates a depth effect through multiple wave layers with different colors
// Uses transform-based animations for optimal 60 FPS performance
// ============================================================================

import type React from "react";
import { ScrollView, View } from "react-native";
import { createColorGenerator } from "@/shared/utils";
import { AnimatedWave } from "./AnimatedWave";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Color generator for blue shades, using blue-500 as base color.
 */
const blueColor = createColorGenerator("#3b82f6");

/**
 * Starting period for the first wave layer.
 * Larger period = fewer curves = better performance
 */
const periodStart = 100;

/**
 * Increment in period for each subsequent wave layer.
 */
const periodDelta = 75;

/**
 * Starting height (vertical position) for the first wave layer.
 */
const heightStart = 55;

/**
 * Vertical position delta for each subsequent wave layer.
 */
const heightDelta = -4;

/**
 * Starting amplitude for the first wave layer.
 */
const amplitudeStart = 5;

/**
 * Amplitude delta for each subsequent wave layer.
 */
const amplitudeDelta = 3;

/**
 * Number of wave layers to render.
 */
const waveCount = 10;

/**
 * Total width of the waves container in pixels.
 * Wider width allows for oscillation without visible edges.
 */
const containerWidth = 4000;

/**
 * Margin offset on left and right sides in pixels.
 * Centers the 4000px width container.
 */
const marginOffset = -1000;

/**
 * Bottom offset for the entire wave container in pixels.
 */
const bottomOffset = -10;

/**
 * Margin offset for the foreground grass layer in pixels.
 */
const grassMarginBottom = -10;

/**
 * Base animation duration in milliseconds.
 */
const animationDurationBase = 30000;

/**
 * Duration increment for each wave layer in milliseconds.
 * Creates varied speeds for natural appearance.
 */
const animationDurationIncrement = 2500;

/**
 * Maximum horizontal displacement in pixels for wave oscillation.
 * Wave will oscillate between -displacement and +displacement.
 */
const waveDisplacementBase = 100;

/**
 * Displacement increment for each wave layer in pixels.
 */
const waveDisplacementDelta = 50;

/**
 * Base animation delay in milliseconds before wave starts moving.
 * Staggered delays create random appearance of motion direction.
 */
const animationDelayBase = 0;

/**
 * Delay increment for each wave layer in milliseconds.
 */
const animationDelayDelta = 10000;

/**
 * Color of the foreground grass.
 */
const foregroundGrassColor = "#56ab91";

/**
 * Color of the background grass. Color palette:
 * https://coolors.co/palette/99e2b4-88d4ab-78c6a3-67b99a-56ab91-469d89-358f80-248277-14746f-036666
 */
const backgroundGrassColor = "#88d4ab";

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * AnimatedWaves component that renders a layered stack of animated waves.
 *
 * Creates a depth effect by stacking multiple wave layers with varying
 * amplitudes, periods, and colors. Includes a foreground grass layer.
 * Each wave oscillates left and right with sinusoidal easing and staggered
 * timing for a natural, organic appearance.
 *
 * Animation uses GPU-accelerated transforms for optimal performance (60 FPS).
 */
export const AnimatedWaves: React.FC = () => {
  return (
    <ScrollView
      className="flex-1 bg-white"
      horizontal
      contentContainerClassName="h-full"
      showsHorizontalScrollIndicator={false}
    >
      <View
        style={{
          width: containerWidth,
          marginLeft: marginOffset,
          marginRight: marginOffset,
          bottom: bottomOffset,
        }}
      >
        {/* Foreground grass */}
        <View
          className="absolute inset-0"
          style={{ zIndex: 100, marginBottom: grassMarginBottom }}
        >
          <AnimatedWave
            amplitude={20}
            period={800}
            fillColor={foregroundGrassColor}
            height={10}
            animationDuration={0}
            waveDisplacement={0}
            animationDelay={0}
          />
        </View>

        {/* Wave layers - biome-ignore lint/suspicious/noArrayIndexKey: waves never reorder */}
        {Array.from({ length: waveCount }).map((_, index) => {
          return (
            <View
              key={index}
              className="absolute inset-0"
              style={{ zIndex: index + 10 }}
            >
              <AnimatedWave
                amplitude={amplitudeStart + index * amplitudeDelta}
                period={periodStart + index * periodDelta}
                fillColor={blueColor(200 + index * 20)}
                height={heightStart + index * heightDelta}
                animationDuration={
                  animationDurationBase + index * animationDurationIncrement
                }
                waveDisplacement={
                  waveDisplacementBase + index * waveDisplacementDelta
                }
                animationDelay={
                  animationDelayBase - index * animationDelayDelta
                }
              />
            </View>
          );
        })}

        {/* Background grass */}
        <View className="absolute inset-0" style={{ zIndex: 0 }}>
          <AnimatedWave
            amplitude={10}
            period={300}
            fillColor={backgroundGrassColor}
            height={65}
            animationDuration={0}
            waveDisplacement={0}
            animationDelay={0}
          />
        </View>
      </View>
    </ScrollView>
  );
};
