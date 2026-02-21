/**
 * TerminalNavButton – Faint circular prev/next button for terminal carousel navigation.
 * 40px circle with bg-white/20 and icon black/20.
 */

import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";

// ============================================================================
// Types
// ============================================================================

type TerminalNavButtonProps = {
  /** Direction of navigation. */
  direction: "prev" | "next";
  /** Called when the button is pressed. */
  onPress: () => void;
  /** Accessibility label (e.g. "Previous terminal", "Next terminal"). */
  accessibilityLabel: string;
};

// ============================================================================
// TerminalNavButton
// ============================================================================

const ICON_COLOR = "rgba(0,0,0,0.2)";

/**
 * Renders a minimal circular navigation button for the terminal carousel.
 *
 * @param direction - Direction of navigation ("prev" or "next")
 * @param onPress - Called when the button is pressed
 * @param accessibilityLabel - Accessibility label for the button
 */
export const TerminalNavButton = ({
  direction,
  onPress,
  accessibilityLabel,
}: TerminalNavButtonProps) => {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-10 w-10 items-center justify-center rounded-full bg-white/20"
    >
      <View className="items-center justify-center">
        <Icon size={20} color={ICON_COLOR} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
};
