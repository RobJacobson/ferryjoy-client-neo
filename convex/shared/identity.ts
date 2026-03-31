/**
 * Shared branded identifier types for canonical vessel and terminal identity.
 *
 * These brands are minted only by centralized validation and resolver helpers
 * so downstream code can distinguish trusted canonical identifiers from raw
 * upstream strings.
 */

/**
 * Generic helper for creating a nominal brand over a primitive type.
 *
 * @param TBase - Underlying runtime type
 * @param TBrand - Unique compile-time brand label
 * @returns Branded version of the base type
 */
export type Brand<TBase, TBrand extends string> = TBase & {
  readonly __brand: TBrand;
};

export type VesselAbbrev = Brand<string, "VesselAbbrev">;
export type VesselName = Brand<string, "VesselName">;
export type TerminalAbbrev = Brand<string, "TerminalAbbrev">;
export type TerminalName = Brand<string, "TerminalName">;

/**
 * Brand a trusted canonical vessel abbreviation.
 *
 * @param value - Canonical vessel abbreviation string
 * @returns Branded vessel abbreviation
 */
export const toVesselAbbrev = (value: string): VesselAbbrev =>
  value as VesselAbbrev;

/**
 * Brand a trusted canonical vessel name.
 *
 * @param value - Canonical vessel name string
 * @returns Branded vessel name
 */
export const toVesselName = (value: string): VesselName => value as VesselName;

/**
 * Brand a trusted canonical terminal abbreviation.
 *
 * @param value - Canonical terminal abbreviation string
 * @returns Branded terminal abbreviation
 */
export const toTerminalAbbrev = (value: string): TerminalAbbrev =>
  value as TerminalAbbrev;

/**
 * Brand a trusted canonical terminal name.
 *
 * @param value - Canonical terminal name string
 * @returns Branded terminal name
 */
export const toTerminalName = (value: string): TerminalName =>
  value as TerminalName;
