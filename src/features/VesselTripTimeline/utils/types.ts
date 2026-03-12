/**
 * Shared generic types for timeline document and render state.
 *
 * These types capture the canonical shape of an ordered timeline document and
 * the render-state derived from it. Feature-specific boundary data, labels,
 * and progress rules are left to the consuming feature via type parameters.
 */

/** Lifecycle phase of a row relative to the current active cursor. */
export type TimelineLifecyclePhase = "upcoming" | "active" | "completed";

/**
 * Canonical ordered row shape shared by timeline features.
 *
 * @typeParam TKind - Feature-specific row kind discriminator
 * @typeParam TBoundary - Feature-specific boundary payload
 * @typeParam TProgressMode - Feature-specific progress mode discriminator
 */
export type TimelineDocumentRow<
  TKind extends string = string,
  TBoundary = unknown,
  TProgressMode extends string = string,
> = {
  id: string;
  segmentIndex: number;
  kind: TKind;
  startBoundary: TBoundary;
  endBoundary: TBoundary;
  geometryMinutes: number;
  fallbackDurationMinutes: number;
  progressMode: TProgressMode;
};

/**
 * Canonical ordered timeline document plus the active row cursor.
 *
 * @typeParam TRow - Feature-owned document row type
 */
export type TimelineDocument<
  TRow extends TimelineDocumentRow = TimelineDocumentRow,
> = {
  rows: TRow[];
  activeSegmentIndex: number;
};

/**
 * Active indicator state shared by timeline overlays.
 *
 * @typeParam TLabel - Feature-owned label payload
 */
export type TimelineActiveIndicator<TLabel = string> = {
  rowId: string;
  rowIndex: number;
  positionPercent: number;
  label: TLabel;
};

/**
 * Render-ready row shape consumed by a feature renderer.
 *
 * @typeParam TKind - Feature-specific row kind discriminator
 * @typeParam TBoundary - Feature-specific render-boundary payload
 */
export type TimelineRenderRow<
  TKind extends string = string,
  TBoundary = unknown,
> = {
  id: string;
  kind: TKind;
  segmentIndex: number;
  geometryMinutes: number;
  startBoundary: TBoundary;
  endBoundary?: TBoundary;
};

/**
 * Render-ready document state derived from the canonical timeline document.
 *
 * @typeParam TRow - Feature-owned render row type
 * @typeParam TIndicator - Feature-owned indicator type
 */
export type TimelineRenderState<
  TRow extends TimelineRenderRow = TimelineRenderRow,
  TIndicator extends TimelineActiveIndicator = TimelineActiveIndicator,
> = {
  rows: TRow[];
  activeIndicator: TIndicator | null;
};
