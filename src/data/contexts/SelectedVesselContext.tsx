import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import type { VesselLocation } from "@/domain";

/**
 * Type definition for the Selected Vessel context value
 */
type SelectedVesselContextType = {
  /** Currently selected vessel, null if none selected */
  selectedVessel: VesselLocation | null;
  /** Function to select a vessel */
  selectVessel: (vessel: VesselLocation | null) => void;
};

/**
 * React context for sharing selected vessel state across the app.
 */
const SelectedVesselContext = createContext<
  SelectedVesselContextType | undefined
>(undefined);

/**
 * Provider component that manages selected vessel state.
 *
 * This component provides selected vessel state that can be shared across tabs.
 *
 * @example
 * ```tsx
 * <SelectedVesselProvider>
 *   <App />
 * </SelectedVesselProvider>
 * ```
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to the selected vessel state
 * @returns A context provider component
 */
export const SelectedVesselProvider = ({ children }: PropsWithChildren) => {
  const [selectedVessel, setSelectedVessel] = useState<VesselLocation | null>(
    null
  );

  const selectVessel = (vessel: VesselLocation | null) => {
    setSelectedVessel(vessel);
  };

  const contextValue: SelectedVesselContextType = {
    selectedVessel,
    selectVessel,
  };

  return (
    <SelectedVesselContext.Provider value={contextValue}>
      {children}
    </SelectedVesselContext.Provider>
  );
};

/**
 * Hook to access selected vessel state.
 *
 * Provides access to the currently selected vessel and a function to select vessels.
 * Must be used within a SelectedVesselProvider component.
 *
 * @example
 * ```tsx
 * const { selectedVessel, selectVessel } = useSelectedVessel();
 * if (selectedVessel) {
 *   console.log(`Selected: ${selectedVessel.VesselName}`);
 * }
 * ```
 *
 * @returns Object with selected vessel state and selection function
 * @throws Error if used outside of SelectedVesselProvider
 */
export const useSelectedVessel = () => {
  const context = useContext(SelectedVesselContext);
  if (context === undefined) {
    throw new Error(
      "useSelectedVessel must be used within SelectedVesselProvider"
    );
  }
  return context;
};
