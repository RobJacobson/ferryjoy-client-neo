/**
 * TerminalNavButton – Minimal circular navigation button (40px, bg-white/20).
 */

import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Button } from "@/components/ui/button";

type TerminalNavButtonProps = {
  direction: "prev" | "next";
  onPress: () => void;
  accessibilityLabel: string;
};

const ICON_COLOR = "rgba(0,0,0,0.2)";

/**
 * Renders minimal circular navigation button.
 * @param direction - Direction of navigation ("prev" or "next")
 * @param onPress - Called when button is pressed
 * @param accessibilityLabel - Accessibility label for button
 */
export const TerminalNavButton = ({
  direction,
  onPress,
  accessibilityLabel,
}: TerminalNavButtonProps) => {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  return (
    <Button
      variant="glass-light"
      size="icon"
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
    >
      <Icon size={20} color={ICON_COLOR} strokeWidth={2.5} />
    </Button>
  );
};
