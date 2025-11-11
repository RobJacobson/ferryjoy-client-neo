/**
 * Utility types and generic conversion functions for domain-Convex transformations.
 * This reduces boilerplate by providing reusable patterns for common conversions.
 */

/**
 * Converts optional properties (T | undefined) to nullable properties (T | null)
 */
export type OptionalToNullable<T> = {
  [K in keyof T]: undefined extends T[K] ? NonNullable<T[K]> | null : T[K];
};

/**
 * Converts specific number fields to Date fields in a type
 */
export type DateFieldsToDate<
  T,
  DateFields extends keyof T,
> = OptionalToNullable<{
  [K in keyof T]: K extends DateFields ? Date : T[K];
}>;

/**
 * Helper to extract date field names from a type based on naming conventions
 * This is a type-level utility to help identify which fields should be treated as dates
 */
export type ExtractDateFields<T> = {
  [K in keyof T]: K extends string
    ? K extends
        | "Date"
        | "Time"
        | `${string}Date`
        | `${string}Time`
        | "TimeStamp"
      ? K
      : never
    : never;
}[keyof T];

/**
 * Helper function to create a date fields array from a type
 * This avoids repeating string literals
 */
export function createDateFieldsArray<T extends Record<string, unknown>>(
  dateFieldNames: ExtractDateFields<T>[]
): ExtractDateFields<T>[] {
  return dateFieldNames;
}

/**
 * Creates a date fields array from a union type of string literals
 * This eliminates the need to define date fields twice
 */
export function createDateFieldsFromUnion<T extends string>(
  dateFields: T[]
): T[] {
  return dateFields;
}

/**
 * Creates a date fields array from a type and a list of keys
 * This allows TypeScript to infer the types without duplication
 */
export function createDateFields<
  T extends Record<string, unknown>,
  K extends keyof T,
>(dateFields: K[]): K[] {
  return dateFields;
}

/**
 * Generic function to convert from storage (Convex) to domain representation
 * Handles:
 * - undefined -> null conversion for optional fields
 * - number -> Date conversion for specified date fields
 */
export function toDomain<
  T extends Record<string, unknown>,
  DateFields extends keyof T,
>(
  stored: T,
  dateFields: readonly DateFields[]
): DateFieldsToDate<T, DateFields> {
  const result = {} as T;

  for (const key in stored) {
    let value: unknown = stored[key];

    // Convert undefined to null for optional fields
    if (value === undefined) {
      value = null;
    }
    // Convert number to Date for specified date fields
    else if (
      dateFields.includes(key as unknown as DateFields) &&
      typeof value === "number"
    ) {
      value = new Date(value);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (result as Record<string, unknown>)[key] = value;
  }

  return result as DateFieldsToDate<T, DateFields>;
}

/**
 * Generic function to convert from domain to storage (Convex) representation
 * Handles:
 * - null -> undefined conversion for nullable fields
 * - Date -> number conversion for specified date fields
 */
export function toStorage<
  T extends Record<string, unknown>,
  DateFields extends keyof T,
>(domain: T, dateFields: readonly DateFields[]): T {
  const result = {} as T;

  for (const key in domain) {
    let value: unknown = domain[key];

    // Convert null to undefined for nullable fields
    if (value === null) {
      value = undefined;
    }
    // Convert Date to number for specified date fields
    else if (
      dateFields.includes(key as unknown as DateFields) &&
      value instanceof Date
    ) {
      value = value.getTime();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (result as Record<string, unknown>)[key] = value;
  }

  return result;
}
