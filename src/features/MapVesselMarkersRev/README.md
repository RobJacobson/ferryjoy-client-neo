# MapVesselMarkersRev

A refactored implementation of vessel markers for the FerryJoy application, following the KISS principle with better separation of concerns and platform-specific code isolation.

## Key Improvements

1. **Simplified Architecture**: Flatter component hierarchy with clearer responsibilities
2. **Platform Separation**: Clear separation of platform-specific code in dedicated files
3. **Composable Design**: Components can be easily reused and extended
4. **Better Testability**: Logic is separated into testable hooks and utilities
5. **Cleaner Code**: Each component has a single, well-defined purpose
6. **Minimal Hooks**: Only using hooks where necessary for complex logic
7. **YAGNI Principle**: Only exporting what's actually needed for typical usage
8. **Consolidated Utilities**: Moved utility functions directly into hooks that use them
9. **Inline Types**: Moved type definitions directly into components that use them
10. **Generic Hooks**: Created reusable hooks that can work with any object having latitude/longitude

## File Structure

```
src/features/MapVesselMarkersRev/
├── components/           # React components
│   ├── VesselMarker.tsx       # Main vessel marker component
│   ├── VesselMarkerContent.tsx # Visual representation of vessel
│   ├── VesselArrow.tsx        # Direction indicator component
│   └── VesselMarkers.tsx      # Collection component for all vessels
├── platform/            # Platform-specific implementations
│   ├── Marker.native.tsx        # Native implementation
│   ├── Marker.web.tsx          # Web implementation
│   ├── types.ts               # Platform-specific types
│   └── index.ts               # Platform exports
├── hooks/              # Custom React hooks
│   └── useVesselMarkerScale.ts  # Scaling logic with utilities
├── index.ts            # Main exports (minimal)
├── ExampleUsage.tsx            # Usage examples
└── README.md           # This file
```

## Usage

### Simple Usage

For most use cases, you can simply use the `VesselMarkers` component:

```tsx
import { VesselMarkers } from "@/features/MapVesselMarkersRev";

const MyMapComponent = () => {
  return (
    <Map>
      {/* Other map components */}
      <VesselMarkers />
    </Map>
  );
};
```

### Advanced Usage

For more control over individual markers, you can use the `VesselMarker` component:

```tsx
import { VesselMarker } from "@/features/MapVesselMarkersRev";

const MyMapComponent = ({ vessels }) => {
  const handleVesselPress = (vessel) => {
    // Handle vessel press
  };

  return (
    <Map>
      {vessels.map((vessel) => (
        <VesselMarker
          key={vessel.VesselID}
          vessel={vessel}
          zIndex={vessel.InService ? 2 : 1}
          onPress={handleVesselPress}
        />
      ))}
    </Map>
  );
};
```

## Component API

### VesselMarkers

Renders all vessels from the `SmoothedVesselPositions` context.

**Props:** None

### VesselMarker

Renders a single vessel marker.

**Props:**
- `vessel: VesselLocation` - The vessel data
- `onPress?: (vessel: VesselLocation) => void` - Optional press handler
- `zIndex?: number` - Optional z-index value

## Platform-Specific Implementation

The marker implementation is separated by platform:

- `Marker.native.tsx` - Uses `@rnmapbox/maps` for native platforms
- `Marker.web.tsx` - Uses `react-map-gl` for web platforms

Both implementations share the same API, ensuring consistent behavior across platforms.

## Custom Hooks

### useVesselMarkerScale

Calculates the scale factor for a vessel marker based on zoom level and perspective.

**Parameters:**
- `vessel: VesselLocation` - The vessel data

**Returns:** `number` - The calculated scale factor

### useMapScale

A generic hook to calculate zoom-based scale factor for any object with latitude and longitude.

**Returns:** `number` - The calculated scale factor (zoom/10)

## Migration from the Old Implementation

To migrate from the old implementation:

1. Replace imports:
   ```tsx
   // Old
   import { MapVesselMarkers } from "@/features/MapVesselMarkers";
   
   // New
   import { VesselMarkers } from "@/features/MapVesselMarkersRev";
   ```

2. Update component usage:
   ```tsx
   // Old
   <MapVesselMarkers />
   
   // New
   <VesselMarkers />
   ```

3. For individual markers:
   ```tsx
   // Old
   <MapVesselMarker vessel={vessel} />
   
   // New
   <VesselMarker vessel={vessel} />
   ```

## Benefits

1. **Reduced Complexity**: Flatter component hierarchy with clearer responsibilities
2. **Better Reusability**: Components can be easily reused for other marker types
3. **Improved Maintainability**: Platform-specific code is isolated and easier to update
4. **Enhanced Testability**: Logic is separated into testable hooks and utilities
5. **Cleaner Code**: Each component has a single, well-defined purpose
6. **Better Performance**: React Compiler handles optimization automatically
7. **Minimal Hooks**: Only using hooks where necessary for complex logic
8. **YAGNI Principle**: Only exporting what's actually needed for typical usage
9. **Consolidated Utilities**: Moved utility functions directly into hooks that use them
10. **Inline Types**: Moved type definitions directly into components that use them
11. **Generic Hooks**: Created reusable hooks that can work with any object having latitude/longitude
