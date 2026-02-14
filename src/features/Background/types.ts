// ============================================================================
// BackgroundFeatures shared types
// ============================================================================

/**
 * Source for the paper texture overlay (Metro require() returns number;
 * remote URLs are string). When null, components do not render the texture.
 */
export type PaperTextureSource = number | string | null;
