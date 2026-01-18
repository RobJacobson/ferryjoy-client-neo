/**
 * Selected terminal route context (pair vs all-terminals).
 *
 * This is persisted so the selected terminal context survives tab switching and
 * app reloads. It also powers the shared navigation header title.
 */

import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo } from "react";
import { z } from "zod";
import { usePersistentState } from "@/shared/hooks";
import { storageKv } from "@/shared/storage";

// ============================================================================
// Types
// ============================================================================

export type SelectedTerminalPair =
  | null
  | {
      kind: "pair";
      from: string;
      dest: string;
    }
  | {
      kind: "all";
      terminal: string;
    };

type SelectedTerminalPairContextValue = Readonly<{
  selectedTerminalPair: SelectedTerminalPair;
  isHydrated: boolean;
  setPair: (from: string, dest: string) => Promise<void>;
  setAll: (terminal: string) => Promise<void>;
  clear: () => Promise<void>;
}>;

// ============================================================================
// Persistence
// ============================================================================

const selectedTerminalPairStorageKey = storageKv.makeKey({
  scope: "navigation",
  version: "v1",
  key: "selectedTerminalPair",
});

const selectedTerminalPairSchema: z.ZodType<SelectedTerminalPair> = z.union([
  z.null(),
  z.object({
    kind: z.literal("pair"),
    from: z.string().min(1),
    dest: z.string().min(1),
  }),
  z.object({
    kind: z.literal("all"),
    terminal: z.string().min(1),
  }),
]);

// ============================================================================
// Context
// ============================================================================

const SelectedTerminalPairContext = createContext<
  SelectedTerminalPairContextValue | undefined
>(undefined);

export const SelectedTerminalPairProvider = ({
  children,
}: PropsWithChildren) => {
  const { value, setValue, remove, isHydrated } =
    usePersistentState<SelectedTerminalPair>(selectedTerminalPairStorageKey, {
      defaultValue: null,
      schema: selectedTerminalPairSchema,
    });

  const contextValue = useMemo<SelectedTerminalPairContextValue>(() => {
    return {
      selectedTerminalPair: value,
      isHydrated,
      setPair: async (from: string, dest: string) => {
        await setValue({
          kind: "pair",
          from: from.toUpperCase(),
          dest: dest.toUpperCase(),
        });
      },
      setAll: async (terminal: string) => {
        await setValue({
          kind: "all",
          terminal: terminal.toUpperCase(),
        });
      },
      clear: async () => {
        await remove();
      },
    };
  }, [isHydrated, remove, setValue, value]);

  return (
    <SelectedTerminalPairContext value={contextValue}>
      {children}
    </SelectedTerminalPairContext>
  );
};

export const useSelectedTerminalPair = (): SelectedTerminalPairContextValue => {
  const context = useContext(SelectedTerminalPairContext);
  if (!context) {
    throw new Error(
      "useSelectedTerminalPair must be used within SelectedTerminalPairProvider"
    );
  }
  return context;
};
