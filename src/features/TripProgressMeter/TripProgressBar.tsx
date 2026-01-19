/**
 * TripProgressBar component for rendering individual progress segments in the trip progress meter.
 * Displays a horizontal progress bar with optional progress indicator that can be portaled
 * to render above other components. Calculates progress based on time values and supports
 * both automatic and manual progress values. Used as building blocks within TripProgressMeter
 * to create multi-segment progress visualizations.
 */

import { Portal } from "@rn-primitives/portal";
import { View, type ViewStyle } from "react-native";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";
import { clamp } from "@/shared/utils";
import { STACKING, shadowStyle } from "./config";
import TripProgressCircle from "./TripProgressCircle";

// ============================================================================
// Types
// ============================================================================

type TripProgressBarProps = {
  /**
   * Start time in epoch milliseconds.
   */
  startTimeMs?: number;
  /**
   * End time in epoch milliseconds.
   */
  endTimeMs?: number;
  /**
   * Current time in epoch milliseconds.
   */
  currentTimeMs: number;
  /**
   * Width as a percentage (0-100).
   */
  percentWidth?: number;
  /**
   * Start offset (0-100) within the whole meter, used to position the progress
   * indicator as a single absolute overlay across the whole meter.
   */
  startOffsetPercent?: number;
  /**
   * Progress value (0-1). If provided, overrides internal calculation.
   */
  progress?: number;
  /**
   * Optional portal host for rendering the progress indicator above markers.
   * When set, the indicator will be rendered into the given portal host.
   */
  portalHostName?: string;
  /**
   * Unique portal name for this bar's indicator (required when portalHostName is set).
   */
  portalName?: string;
  zIndex?: number;
  className?: string;
  style?: ViewStyle;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a horizontal progress bar with optional progress indicator overlay.
 * Calculates progress automatically from time values or accepts manual progress override.
 * Supports flexible width sizing and portal-based rendering for indicators that need
 * to appear above other components. The progress bar consists of a background track
 * and a filled progress portion, with an optional circular indicator showing minutes remaining.
 *
 * @param startTimeMs - Start time in epoch milliseconds for automatic progress calculation
 * @param endTimeMs - End time in epoch milliseconds for automatic progress calculation
 * @param currentTimeMs - Current time in epoch milliseconds for automatic progress calculation
 * @param percentWidth - Width as percentage (0-100), otherwise uses flex-1
 * @param startOffsetPercent - Offset within parent container for portal positioning
 * @param progress - Manual progress value (0-1), overrides automatic calculation if provided
 * @param portalHostName - Portal host name for rendering indicator above other elements
 * @param portalName - Unique portal name for this bar's indicator
 * @param zIndex - Z-index for layering the progress bar
 * @param className - Additional CSS classes for styling
 * @param style - Additional inline styles
 * @returns A View containing the progress bar and optionally portaled progress indicator
 */
const TripProgressBar = ({
  startTimeMs,
  endTimeMs,
  currentTimeMs,
  percentWidth,
  startOffsetPercent,
  progress: progressProp,
  portalHostName,
  portalName,
  zIndex,
  className,
  style,
}: TripProgressBarProps) => {
  const progress =
    progressProp ?? calculateProgress(startTimeMs, endTimeMs, currentTimeMs);

  // Use flex-1 if no explicit width is provided.
  const hasExplicitWidth = percentWidth !== undefined;
  const flexClass = hasExplicitWidth ? "" : "flex-1";

  const inProgress = progress > 0 && progress < 1;
  const minutesRemaining = calculateMinutesRemaining(endTimeMs, currentTimeMs);

  const shouldRenderIndicator =
    portalHostName !== undefined &&
    portalName !== undefined &&
    startOffsetPercent !== undefined &&
    percentWidth !== undefined &&
    inProgress;

  // Calculate indicator position
  const calculatedLeftPercent =
    (startOffsetPercent ?? 0) + (progress ?? 0) * (percentWidth ?? 0);

  const indicatorLeftPercent = shouldRenderIndicator
    ? calculatedLeftPercent
    : 0;

  return (
    <>
      <View
        className={cn("relative", flexClass, className)}
        style={{
          overflow: "visible",
          zIndex,
          elevation: zIndex,
          ...(percentWidth !== undefined && { width: `${percentWidth}%` }),
          ...style,
        }}
      >
        <View
          className="flex-1 bg-primary/20 rounded-full h-3 items-start"
          style={{ zIndex: 1 }}
        >
          <View
            className="bg-pink-300 rounded-full h-full"
            style={{ width: `${progress * 100}%`, zIndex: 1, ...shadowStyle }}
          />
        </View>
      </View>

      {shouldRenderIndicator && portalHostName && portalName ? (
        <Portal name={portalName} hostName={portalHostName}>
          <TripProgressCircle
            left={`${indicatorLeftPercent}%`}
            backgroundColor="bg-pink-500"
            borderColor=""
            size={32}
            zIndex={STACKING.progressCircle}
          >
            <View className="border border-white p-1 rounded-full w-full items-center justify-center">
              <Text className="text-sm font-semibold text-white">
                {minutesRemaining}
              </Text>
            </View>
          </TripProgressCircle>
        </Portal>
      ) : null}
    </>
  );
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculates progress value (0-1) from time values.
 *
 * @param startTimeMs - Start time in milliseconds
 * @param endTimeMs - End time in milliseconds
 * @param currentTimeMs - Current time in milliseconds
 * @returns Progress value between 0 and 1
 */
export const calculateProgress = (
  startTimeMs?: number,
  endTimeMs?: number,
  currentTimeMs?: number
): number => {
  if (!startTimeMs || !endTimeMs || !currentTimeMs) {
    return 0;
  }

  // Handle invalid time ordering
  if (endTimeMs <= startTimeMs) {
    return currentTimeMs >= endTimeMs ? 1 : 0;
  }

  // Calculate progress using linear interpolation and clamp to [0, 1]
  const progressValue =
    (currentTimeMs - startTimeMs) / (endTimeMs - startTimeMs);
  return clamp(progressValue, 0, 1);
};

/**
 * Calculates minutes remaining until the end time.
 *
 * @param endTimeMs - End time in milliseconds
 * @param currentTimeMs - Current time in milliseconds
 * @returns Number of minutes remaining, rounded up
 */
export const calculateMinutesRemaining = (
  endTimeMs?: number,
  currentTimeMs?: number
): number => {
  if (!endTimeMs || !currentTimeMs) {
    return 0;
  }

  const remainingMs = endTimeMs - currentTimeMs;
  if (remainingMs <= 0) {
    return 0;
  }

  // Convert milliseconds to minutes and round up
  return Math.ceil(remainingMs / (1000 * 60));
};

export default TripProgressBar;
