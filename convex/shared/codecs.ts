import { z } from "zod";

/**
 * Codec for converting between epoch milliseconds (number) and Date objects
 *
 * This is used to automatically transform Date objects in the domain layer
 * to/from numbers (timestamps) for Convex storage.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   timestamp: epochMillisToDate,
 *   optionalDate: optionalEpochMillisToDate,
 * });
 *
 * // Decode from Convex (number -> Date)
 * const domain = schema.decode({ timestamp: 1234567890 });
 *
 * // Encode to Convex (Date -> number)
 * const convex = schema.encode({ timestamp: new Date() });
 * ```
 */
export const epochMillisToDate = z.codec(
  z.number(), // Input schema: number (Convex storage format)
  z.date(), // Output schema: Date (domain format)
  {
    decode: (num) => new Date(num), // number → Date
    encode: (date) => date.getTime(), // Date → number
  }
);

/**
 * Optional variant of epochMillisToDate codec
 *
 * Use this for optional date fields that may be undefined.
 */
export const optionalEpochMillisToDate = epochMillisToDate.optional();
