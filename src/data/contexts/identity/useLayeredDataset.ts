import { useEffect, useMemo, useState } from "react";
import type { ZodType } from "zod";
import { storageKv } from "@/shared/storage";
import type { GetJsonResult } from "@/shared/storage/kv";

export type LayeredDatasetSource = "asset" | "storage" | "convex";

type LayeredDatasetState<TData> = Readonly<{
  data: TData;
  source: LayeredDatasetSource;
  isHydrated: boolean;
}>;

const SOURCE_PRIORITY: Record<LayeredDatasetSource, number> = {
  asset: 0,
  storage: 1,
  convex: 2,
};

export const createInitialLayeredDatasetState = <TData>(
  assetData: TData
): LayeredDatasetState<TData> => ({
  data: assetData,
  source: "asset",
  isHydrated: false,
});

export const applyLayeredDatasetUpdate = <TData>(
  state: LayeredDatasetState<TData>,
  update: Readonly<{
    data: TData;
    source: Exclude<LayeredDatasetSource, "asset">;
  }>
): LayeredDatasetState<TData> => {
  if (SOURCE_PRIORITY[update.source] < SOURCE_PRIORITY[state.source]) {
    return state;
  }

  return {
    ...state,
    data: update.data,
    source: update.source,
  };
};

export const applyStorageHydrationResult = <TData>(
  state: LayeredDatasetState<TData>,
  result: GetJsonResult<TData>
): LayeredDatasetState<TData> => {
  const hydratedState = {
    ...state,
    isHydrated: true,
  } satisfies LayeredDatasetState<TData>;

  if (!result.ok || result.value == null) {
    return hydratedState;
  }

  return applyLayeredDatasetUpdate(hydratedState, {
    data: result.value,
    source: "storage",
  });
};

type UseLayeredDatasetArgs<TData, TDerived> = Readonly<{
  assetData: TData;
  storageKey: string;
  storageSchema?: ZodType<TData>;
  convexData: TData | null | undefined;
  derive: (data: TData) => TDerived;
}>;

type LayeredDatasetValue<TData, TDerived> = Readonly<
  {
    data: TData;
    source: LayeredDatasetSource;
    isHydrated: boolean;
  } & TDerived
>;

/**
 * Resolve one dataset from compiled assets, then local storage, then Convex.
 *
 * Assets are available synchronously for startup resilience. Storage hydration
 * is asynchronous and may upgrade the dataset while still offline. Convex
 * always wins once it arrives.
 */
export const useLayeredDataset = <TData, TDerived>({
  assetData,
  storageKey,
  storageSchema,
  convexData,
  derive,
}: UseLayeredDatasetArgs<TData, TDerived>): LayeredDatasetValue<
  TData,
  TDerived
> => {
  const [state, setState] = useState<LayeredDatasetState<TData>>(() =>
    createInitialLayeredDatasetState(assetData)
  );

  useEffect(() => {
    let isCancelled = false;

    const hydrate = async () => {
      const result = await storageKv.getJson<TData>(
        storageKey,
        storageSchema ? { schema: storageSchema } : undefined
      );

      if (isCancelled) {
        return;
      }

      setState((previous) => applyStorageHydrationResult(previous, result));
    };

    void hydrate();

    return () => {
      isCancelled = true;
    };
  }, [storageKey, storageSchema]);

  useEffect(() => {
    if (convexData === undefined || convexData === null) {
      return;
    }

    setState((previous) =>
      applyLayeredDatasetUpdate(previous, {
        data: convexData,
        source: "convex",
      })
    );

    void persistConvexDataset(storageKey, convexData);
  }, [convexData, storageKey]);

  const derived = useMemo(() => derive(state.data), [derive, state.data]);

  return useMemo(
    () => ({
      data: state.data,
      source: state.source,
      isHydrated: state.isHydrated,
      ...derived,
    }),
    [derived, state.data, state.isHydrated, state.source]
  );
};

const persistConvexDataset = async <TData>(storageKey: string, data: TData) => {
  try {
    await storageKv.setJson(storageKey, data);
  } catch {
    // Ignore storage write failures and keep the in-memory dataset live.
  }
};
