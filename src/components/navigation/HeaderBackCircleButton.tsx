/**
 * Shared circular back button for tab headers.
 *
 * If a terminal selection exists, this renders a circular icon button that:
 * - clears the selection
 * - navigates back to Home (/)
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Pressable } from "react-native";
import { useSelectedTerminalPair } from "@/data/contexts";

// ============================================================================
// Main component
// ============================================================================

export const HeaderBackCircleButton = () => {
  const navigation = useNavigation();
  const router = useRouter();
  const { selectedTerminalPair, isHydrated, clear } = useSelectedTerminalPair();

  if (!isHydrated || selectedTerminalPair == null) {
    return null;
  }

  const handlePress = () => {
    // Prefer popping the *parent* stack so this behaves like leaving (tabs)
    // back to Home (/) with a proper "back" animation.
    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
      // Clear after initiating navigation to avoid a header flicker.
      setTimeout(() => {
        void clear();
      }, 0);
      return;
    }

    // Fallback: normal back if we truly have a back stack here.
    if (navigation.canGoBack()) {
      navigation.goBack();
      setTimeout(() => {
        void clear();
      }, 0);
      return;
    }

    // Deep-link fallback (no back stack at all).
    router.replace("/");
    setTimeout(() => {
      void clear();
    }, 0);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to route selection"
      onPress={handlePress}
      hitSlop={12}
      className="ml-3 h-9 w-9 items-center justify-center rounded-full bg-slate-100"
    >
      <Ionicons name="arrow-back" size={18} color="#0f172a" />
    </Pressable>
  );
};
