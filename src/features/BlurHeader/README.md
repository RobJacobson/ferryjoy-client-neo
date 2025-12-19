# BlurHeader Feature

Provides iOS Contacts-style blurred header overlays for screens with both blur and opacity gradients.

## Components

### `BlurPage`

A screen wrapper that adds an iOS 26 Contacts-style header with both progressive blur and opacity gradients.

**Features:**
1. **Progressive blur gradient** (optional): Content becomes more blurry as it scrolls up
2. **Progressive opacity gradient**: Tint overlay fades out smoothly as it approaches content

```tsx
import { BlurPage } from "@/features/BlurHeader";

<BlurPage
  navBarHeight={56}
  overlayProps={{
    // iOS 26 Contacts-style: progressive blur + tint that fades out toward content
    progressive: true,
    fadeStart: 0.5,
    opacity: 0.8,
    blurAmount: 30,        // Blur intensity (0-100)
    blurType: "light",     // 'light', 'dark', 'xlight', 'extraDark'
    blurDirection: "blurredTopClearBottom",
    blurStartOffset: 0,    // Where blur gradient starts (0-1)
  }}
>
  {({ contentInsetTop }) => (
    <ScrollView style={{ paddingTop: contentInsetTop }}>
      {/* Your content */}
    </ScrollView>
  )}
</BlurPage>
```

### `BlurOverlay`

Low-level overlay component with advanced configuration. Use this when you need more control than `BlurPage` provides.

```tsx
import { BlurOverlay } from "@/features/BlurHeader";

<BlurOverlay
  position="top"
  height={100}
  tintColor="#FFFFFF"
  opacity={0.8}
  progressive={true}
  fadeStart={0.35}
  blurAmount={20}
  blurType="light"
/>
```

## API Reference

### BlurPage Props

```tsx
interface BlurPageProps {
  children: React.ReactNode | ((layout: BlurPageLayout) => React.ReactNode);
  navBarHeight?: number;  // Default: 56
  style?: StyleProp<ViewStyle>;
  overlayProps?: Omit<BlurOverlayProps, "position" | "height" | "extendIntoNotch">;
}

interface BlurPageLayout {
  contentInsetTop: number;  // Total overlay height (safe area + nav)
  safeAreaTop: number;      // Safe area inset at top
  navBarHeight: number;     // Nav/header portion below safe area
}
```

### BlurOverlay Props

```tsx
interface BlurOverlayProps {
  // Position & sizing
  position?: "top" | "bottom";           // Default: "top"
  height?: number;                       // Explicit height (auto-calculated if omitted)
  extendIntoNotch?: boolean;             // Default: true for top position

  // Appearance
  tintColor?: string;                    // Default: "#FFFFFF"
  opacity?: number;                      // Max opacity (0-1), default: 0.5

  // Opacity gradient
  progressive?: boolean;                 // Enable fade effect, default: true
  fadeStart?: number;                    // Fade start point (0-1), default: 0.35

  // Blur gradient (optional - set blurAmount > 0 to enable)
  blurAmount?: number;                   // Blur intensity (0-100), default: 0
  blurType?: "light" | "dark" | "xlight" | "extraDark";  // Default: "light"
  blurDirection?: "blurredTopClearBottom" | "blurredBottomClearTop";
  blurStartOffset?: number;              // Blur start point (0-1), default: 0

  // Layout
  zIndex?: number;                       // Default: 1000
  style?: StyleProp<ViewStyle>;
}
```

## Usage Patterns

### Render Prop Pattern

Use the render prop form to get `contentInsetTop` for ScrollView padding:

```tsx
<BlurPage>
  {({ contentInsetTop }) => (
    <ScrollView style={{ paddingTop: contentInsetTop }}>
      {/* Content */}
    </ScrollView>
  )}
</BlurPage>
```

### Direct Children

Pass children directly (no automatic padding):

```tsx
<BlurPage>
  <View style={{ paddingTop: 100 }}>
    {/* Manually padded content */}
  </View>
</BlurPage>
```

## Common Presets

**iOS 26 Contacts-style (strong blur + tint):**
```tsx
{
  progressive: true,
  fadeStart: 0.5,
  opacity: 0.8,
  blurAmount: 30,
  blurType: "light",
}
```

**Softer fade (less blur):**
```tsx
{
  progressive: true,
  fadeStart: 0.55,
  opacity: 0.7,
  blurAmount: 20,
  blurType: "light",
}
```

**Opacity only (no blur):**
```tsx
{
  progressive: true,
  fadeStart: 0.5,
  opacity: 0.8,
  blurAmount: 0,  // Disables blur gradient
}
```

## Platform Support

- **iOS**: Full support with native ProgressiveBlurView
- **Android**: Full support with native ProgressiveBlurView
- **Web**: Opacity-only gradient (blur not supported)

## Accessibility

Automatically respects the system "Reduce Transparency" setting:
- When enabled: Falls back to solid color overlay
- When disabled: Shows full blur + opacity gradient effect

## Dependencies

- `@sbaiahmed1/react-native-blur` (for blur gradients)
- `@react-native-masked-view/masked-view` (for opacity gradients)
- `react-native-svg` (for gradient definitions)

**Important:** These native libraries require a rebuild when added to an Expo Dev Client project.