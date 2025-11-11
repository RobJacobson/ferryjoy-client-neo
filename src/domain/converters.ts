/**
 * Shared helpers for converting between nullable values and optional storage shapes.
 */

export const dateOrNull = (value?: number): Date | null =>
  value !== undefined ? new Date(value) : null;

export const dateToNumber = (value: Date | null): number | undefined =>
  value ? value.getTime() : undefined;

export const nullIfUndefined = <T>(value: T | undefined): T | null =>
  value === undefined ? null : value;

export const undefinedIfNull = <T>(value: T | null): T | undefined =>
  value === null ? undefined : value;
