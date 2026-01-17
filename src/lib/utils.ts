import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function for combining class names with Tailwind CSS.
 * Merges class names and handles conflicts using tailwind-merge.
 *
 * @param inputs - Class values to merge (strings, objects, arrays, etc.)
 * @returns Merged class name string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
