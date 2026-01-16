/**
 * Strip Convex document metadata fields.
 *
 * Convex documents frequently include `_id` and `_creationTime` metadata. This
 * helper removes those fields so callers can work with plain domain records.
 *
 * @param doc - Convex document with metadata fields
 * @returns Document with metadata fields removed
 */
export const stripConvexMeta = <T extends Record<string, unknown>>(
  doc: T
): Omit<T, "_id" | "_creationTime"> => {
  const {
    _id: _ignoredId,
    _creationTime: _ignoredCreationTime,
    ...rest
  } = doc as T & {
    _id?: unknown;
    _creationTime?: unknown;
  };

  return rest as Omit<T, "_id" | "_creationTime">;
};
