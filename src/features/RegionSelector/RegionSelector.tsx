/**
 * Region Selector Component
 *
 * A dropdown selector for filtering terminals by region on the homepage.
 * Manages persistent state using KV store and usePersistentState hook.
 */

import type { TriggerRef } from "@rn-primitives/select";
import { useRef } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import {
  type Option,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TERMINAL_REGIONS, type TerminalRegion } from "@/data/terminalRegions";
import { usePersistentState } from "@/shared/hooks";
import { storageKv } from "@/shared/storage";

// ============================================================================
// Constants & types
// ============================================================================

/**
 * Zod schema for validating persisted region filter value.
 */
const terminalRegionSchema = z.enum([
  "All Terminals",
  "San Juan Islands",
  "Seattle/Central",
  "Edmonds/Kingston",
  "Mukiteo/Whidby Islands",
  "South Sound/Vashon",
]);

/**
 * Storage key for the terminal region filter preference.
 */
const regionFilterStorageKey = storageKv.makeKey({
  scope: "home",
  version: "v1",
  key: "terminalRegionFilter",
});

/**
 * Array of all valid region names for the Select dropdown.
 */
const regionOptions: TerminalRegion[] = Object.keys(
  TERMINAL_REGIONS
) as TerminalRegion[];

// ============================================================================
// Main component
// ============================================================================

export interface RegionSelectorProps {
  /**
   * Optional callback invoked when the selected region changes.
   * Useful for triggering re-renders in parent components.
   *
   * @param region - The newly selected region
   */
  onRegionChange?: (region: TerminalRegion) => void;
}

/**
 * RegionSelector component that displays a dropdown for filtering terminals by region.
 * Manages persistent state internally using the same storage key as useRegionSelector hook.
 *
 * @param props - Component props
 * @param props.onRegionChange - Optional callback when region selection changes
 * @returns The region selector dropdown component
 */
export const RegionSelector = ({
  onRegionChange,
}: RegionSelectorProps = {}) => {
  const ref = useRef<TriggerRef>(null);
  const insets = useSafeAreaInsets();
  const {
    value: selectedRegion,
    setValue: setSelectedRegion,
    isHydrated,
  } = usePersistentState<TerminalRegion>(regionFilterStorageKey, {
    defaultValue: "All Terminals",
    schema: terminalRegionSchema,
  });

  const selectedOption: Option | undefined = isHydrated
    ? regionToOption(selectedRegion)
    : regionToOption("All Terminals");

  const contentInsets = {
    top: insets.top,
    bottom: Platform.select({
      ios: insets.bottom,
      android: insets.bottom + 24,
    }),
    left: 12,
    right: 12,
  };

  // Workaround for rn-primitives/select not opening on mobile
  // Use onPress for iOS (single tap) instead of onTouchStart (which requires press and hold)
  const handlePress = () => {
    ref.current?.open();
  };

  const handleValueChange = async (option: Option | undefined) => {
    const newRegion = optionToRegion(option);
    await setSelectedRegion(newRegion);
    onRegionChange?.(newRegion);
  };

  return (
    <View className="mt-4">
      <Select value={selectedOption} onValueChange={handleValueChange}>
        <SelectTrigger
          ref={ref}
          className="bg-white/10 border-white/20 [&_*]:text-white"
          onPress={Platform.OS === "ios" ? handlePress : undefined}
          onTouchStart={Platform.OS !== "ios" ? handlePress : undefined}
        >
          <SelectValue placeholder="All Terminals" />
        </SelectTrigger>
        <SelectContent insets={contentInsets}>
          <SelectGroup>
            <SelectLabel>Filter by Region</SelectLabel>
            {regionOptions.map((region) => (
              <SelectItem key={region} value={region} label={region}>
                {region}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </View>
  );
};

/**
 * Hook to get the current selected region from the RegionSelector's persistent state.
 * Useful when you need to read the current region without rendering the selector.
 *
 * @returns Object with selected region, hydration state, and error
 */
export const useRegionSelector = () => {
  const {
    value: selectedRegion,
    isHydrated,
    error,
  } = usePersistentState<TerminalRegion>(regionFilterStorageKey, {
    defaultValue: "All Terminals",
    schema: terminalRegionSchema,
  });

  return {
    selectedRegion: selectedRegion ?? "All Terminals",
    isHydrated,
    error,
  };
};

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Convert a TerminalRegion string to an Option object for the Select component.
 *
 * @param region - The region name string
 * @returns Option object with value and label
 */
const regionToOption = (region: TerminalRegion): Option => ({
  value: region,
  label: region,
});

/**
 * Convert an Option object back to a TerminalRegion string.
 *
 * @param option - The Option object from Select
 * @returns TerminalRegion string
 */
const optionToRegion = (option: Option | undefined): TerminalRegion => {
  if (!option) return "All Terminals";
  return option.value as TerminalRegion;
};
