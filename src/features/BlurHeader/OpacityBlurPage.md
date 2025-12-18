# Opacity Header Feature

A feature that provides iOS Contacts-style header overlays with progressive opacity fading for screens.

## OpacityBlurPage

A small screen wrapper that emulates the **iOS 26 Contacts-style header**: an **opacity overlay** that becomes **more visually pronounced near the notch/navigation area**, fading out smoothly as it approaches the content.

This is implemented as:

- A **vertical gradient mask** (via `@react-native-masked-view/masked-view` + `react-native-svg`) so the tint fades out smoothly (no hard bottom edge)
- A **tint overlay** with progressive opacity that fades from full opacity at the top to transparent at the bottom

## Dependencies

Already used/required by this implementation:

- `@react-native-masked-view/masked-view`
- `react-native-svg`

### Rebuild note (important)

`@react-native-masked-view/masked-view` includes a native view (`RNCMaskedView`). If you add it to an Expo Dev Client project you must **rebuild** the native app for it to be available.

If you see:

- `Invariant Violation: View config not found for component 'RNCMaskedView'`

…it means the app binary wasn't rebuilt after installing the package.

## Feature Structure

This feature is organized as follows:

- **`OpacityBlurPage`**: High-level page wrapper component for easy integration
- **`OpacityBlurOverlay`**: Low-level opacity overlay component with advanced configuration
- **`opacityBlurUtils.ts`**: Shared utility functions for color handling
- **`index.ts`**: Main exports for the feature

## Usage

Wrap a screen with `OpacityBlurPage`. Use the render-prop form to get `contentInsetTop`, then pad your scroll/content so it can scroll underneath the header.

Example (`src/app/(tabs)/vessels.tsx`):

```tsx
import { OpacityBlurPage } from "@/features/BlurHeader";
import { VesselsTripList } from "@/features/VesselsTripList";

export default function VesselsScreen() {
  return (
    <OpacityBlurPage
      navBarHeight={56}
      overlayProps={{
        progressive: true,
        fadeStart: 0.5,
        opacity: 0.8,
      }}
    >
      {({ contentInsetTop }) => (
        <VesselsTripList contentInsetTop={contentInsetTop} />
      )}
    </OpacityBlurPage>
  );
}
```

## Tuning

All tuning knobs live on `Opacity`BlurOverlay` and are passed via `overlayProps`:

- `opacity`: overall perceived header strength near the top (0..1)
- `fadeStart` (0..1): where the fade begins; higher = longer solid region before fading starts
- `tintColor`: color of the overlay (default: `#FFFFFF`)

Common presets:

- **More Contacts-like / stronger**: `opacity: 0.8`, `fadeStart: 0.5`
- **Softer fade**: `fadeStart: 0.55`, `opacity: 0.7`

## How it's wired

- `OpacityBlurPage` computes `contentInsetTop = insets.top + navBarHeight`.
- It renders `OpacityBlurOverlay` at the top with `height={contentInsetTop}`.
- Your content uses `contentInsetTop` to ensure it can scroll beneath the header.

## Render Prop Pattern

The component uses a **render prop pattern** where `children` can be either:
- A React node (rendered as-is)
- A function that receives layout props and returns a React node

This pattern provides flexibility while ensuring type safety and explicit prop usage.
