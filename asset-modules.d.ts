/**
 * Type declarations for static imports of image assets.
 * Metro bundles these as numeric asset IDs at runtime.
 */
declare module "*.png" {
  const value: number;
  export default value;
}
