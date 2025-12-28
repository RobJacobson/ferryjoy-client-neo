// ============================================================================
// CUSTOM FUNCTIONAL UTILITIES
// Lightweight functional programming utilities for ML pipeline
// ============================================================================

/**
 * Result type for synchronous error handling
 * Replaces exceptions with explicit error types
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Task type for async operations
 */
export type Task<T> = () => Promise<T>;
export type TaskResult<T> = Task<Result<T>>;

/**
 * Function composition utilities
 */
export const pipe = <T>(value: T) => ({
  to: <U>(fn: (x: T) => U) => pipe(fn(value)),
  value: () => value,
});

export const compose =
  <A, B, C>(f: (x: B) => C, g: (x: A) => B) =>
  (x: A): C =>
    f(g(x));

/**
 * Result constructors and operations
 */
export const success = <T>(data: T): Result<T> => ({ success: true, data });
export const failure = (error: string): Result<never> => ({
  success: false,
  error,
});

export const mapResult = <T, U>(
  result: Result<T>,
  fn: (data: T) => U
): Result<U> =>
  result.success ? success(fn(result.data)) : (result as Result<U>);

export const flatMapResult = <T, U>(
  result: Result<T>,
  fn: (data: T) => Result<U>
): Result<U> => (result.success ? fn(result.data) : (result as Result<U>));

export const foldResult = <T, U>(
  result: Result<T>,
  onSuccess: (data: T) => U,
  onFailure: (error: string) => U
): U =>
  result.success
    ? onSuccess(result.data)
    : onFailure((result as { success: false; error: string }).error);

/**
 * Task result operations
 */
export const mapTaskResult =
  <T, U>(task: TaskResult<T>, fn: (data: T) => U): TaskResult<U> =>
  async () => {
    const result = await task();
    return result.success ? success(fn(result.data)) : (result as Result<U>);
  };

export const flatMapTaskResult =
  <T, U>(task: TaskResult<T>, fn: (data: T) => TaskResult<U>): TaskResult<U> =>
  async () => {
    const result = await task();
    if (!result.success) return result as Result<U>;
    return await fn(result.data)();
  };

export const foldTaskResult =
  <T, U>(
    task: TaskResult<T>,
    onSuccess: (data: T) => U,
    onFailure: (error: string) => U
  ): Task<U> =>
  async () => {
    const result = await task();
    return result.success
      ? onSuccess(result.data)
      : onFailure((result as { success: false; error: string }).error);
  };

/**
 * Pipeline creation utilities
 */
export const createPipeline =
  <TInput, TOutput>(...steps: Array<(input: any) => any>) =>
  (input: TInput): TOutput =>
    steps.reduce((acc, step) => step(acc), input) as unknown as TOutput;

export const createAsyncPipeline =
  <TInput, TOutput>(...steps: Array<(input: any) => Promise<any>>) =>
  async (input: TInput): Promise<TOutput> => {
    let result = input;
    for (const step of steps) {
      result = await step(result);
    }
    return result as unknown as TOutput;
  };

/**
 * Async pipeline with error handling
 */
export const createSafeAsyncPipeline =
  <TInput, TOutput>(...steps: Array<(input: any) => TaskResult<any>>) =>
  (input: TInput): TaskResult<TOutput> =>
  async () => {
    let current: any = input;

    for (const step of steps) {
      const result = await step(current)();
      if (!result.success) return result;
      current = result.data;
    }

    return success(current as TOutput);
  };

/**
 * Array utilities for functional programming
 */
export const filterMap = <T, U>(
  array: T[],
  predicate: (item: T) => boolean,
  mapper: (item: T) => U
): U[] => array.filter(predicate).map(mapper);

export const groupBy = <T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> =>
  array.reduce(
    (groups, item) => {
      const key = keyFn(item);
      (groups[key] ||= []).push(item);
      return groups;
    },
    {} as Record<K, T[]>
  );

/**
 * Validation utilities
 */
export const validate = <T>(
  value: T,
  ...validators: Array<(value: T) => Result<T>>
): Result<T> => {
  for (const validator of validators) {
    const result = validator(value);
    if (!result.success) return result;
  }
  return success(value);
};

/**
 * Logging utilities for debugging
 */
export const withLogging =
  <T>(task: TaskResult<T>, label: string): TaskResult<T> =>
  async () => {
    console.log(`[${label}] Starting...`);
    try {
      const result = await task();
      if (result.success) {
        console.log(`[${label}] Success:`, result.data);
      } else {
        console.error(
          `[${label}] Failed:`,
          (result as { success: false; error: string }).error
        );
      }
      return result;
    } catch (error) {
      console.error(`[${label}] Exception:`, error);
      throw error;
    }
  };
