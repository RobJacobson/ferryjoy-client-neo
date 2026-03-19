declare module "bun:test" {
  type BunTestMatchers = {
    not: BunTestMatchers;
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toHaveLength(expected: number): void;
    toBeTrue(): void;
    toBeFalse(): void;
    toThrow(expected?: unknown): void;
    toBeUndefined(): void;
    toContain(expected: unknown): void;
    toMatch(expected: RegExp | string): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeNull(): void;
  };

  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void): void;
  export function expect(actual: unknown): BunTestMatchers;
}
