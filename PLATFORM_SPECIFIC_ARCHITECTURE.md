# React Native Platform-Specific Component Architecture Pattern

## Overview

This document outlines the architectural pattern for implementing platform-specific components in React Native with maximum code reuse and clean separation of concerns. This pattern ensures that shared logic is centralized while platform-specific code is isolated to minimal wrapper components.

## Core Principles

1. **Single Responsibility**: Each component has a clear, single purpose
2. **Interface Consistency**: Identical props interface for all platform implementations
3. **Minimal Platform Code**: Platform files contain only what's necessary for that platform
4. **Child Props Pattern**: Visual components passed as children to platform-specific wrappers
5. **Bundler Awareness**: File extensions signal platform specificity for automatic selection

## File Structure

```
ComponentName/
├── ComponentName.tsx      # Main component with shared logic
├── ComponentName.web.tsx  # Web platform implementation
├── ComponentName.tsx       # Native platform implementation
├── types.ts              # Shared type definitions
└── index.ts              # Module exports
```

## Implementation Pattern

### 1. Main Component (ComponentName.tsx)

Contains all shared business logic and data fetching:
- Handles state management and data processing
- Defines visual components using NativeWind for styling
- Passes visual components as children to platform-specific wrappers
- Keeps platform-agnostic code separate from platform-specific code

**Example: MapVesselMarkers.tsx**
```typescript
/**
 * MapVesselMarkers component
 * Fetches real-time vessel data from VesselLocations context and renders vessel markers on map
 */

import type { VesselLocation } from "ws-dottie/wsf-vessels"
import { View } from "react-native"
import { useMapState, useWsDottie } from "@/shared/contexts"
import { Marker } from "./Marker"

// Minimum zoom level at which vessel markers should be displayed
const MIN_ZOOM_FOR_VESSELS = 8

/**
 * Determines whether vessel markers should be displayed based on current zoom level
 */
const shouldShowVessels = (zoom: number): boolean => {
  return zoom >= MIN_ZOOM_FOR_VESSELS
}

/**
 * Creates a press handler for vessel markers
 */
const createVesselPressHandler = (
  vessel: VesselLocation,
  onVesselPress?: (vessel: VesselLocation) => void
): (() => void) => {
  return () => {
    onVesselPress?.(vessel)
  }
}

/**
 * MapVesselMarkers component
 * Fetches real-time vessel data and renders markers on the map
 */
export const MapVesselMarkers = ({
  onVesselPress,
}: {
  onVesselPress?: (vessel: VesselLocation) => void
}) => {
  const { zoom } = useMapState()
  const { vesselLocations } = useWsDottie()

  // Handle loading state
  if (vesselLocations.isLoading) {
    return null
  }

  // Handle error state
  if (vesselLocations.isError) {
    console.error("Error loading vessel locations:", vesselLocations.error)
    return null
  }

  // Handle empty data
  if (!vesselLocations.data || vesselLocations.data.length === 0) {
    return null
  }

  // Only show vessels when zoomed in enough
  if (!shouldShowVessels(zoom)) {
    return null
  }

  return (
    <>
      {vesselLocations.data.map((vessel: VesselLocation) => {
        const handleVesselPress = createVesselPressHandler(
          vessel,
          onVesselPress
        )

        return (
          <Marker
            key={`${vessel.VesselID}`}
            longitude={vessel.Longitude}
            latitude={vessel.Latitude}
            onPress={handleVesselPress}
          >
            <View className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white justify-center items-center">
              <View className="w-2 h-2 bg-white rounded-full" />
            </View>
          </Marker>
        )
      })}
    </>
  )
}
```

### 2. Platform-Specific Implementation Files

Create two files with identical interfaces:
- `ComponentName.web.tsx` for web implementation
- `ComponentName.tsx` for native implementation

Each file should:
- Contain ONLY the minimum code necessary for that platform
- Implement the same interface defined in shared types
- Have no duplication of logic between platform files
- Be automatically selected by bundler at compile time
- Keep native components to minimum viable code while everything else is shared code in the parent

**Example: Marker.tsx (Native)**
```typescript
/**
 * Native marker component for vessel
 * Wraps MapboxRN.MarkerView to abstract platform differences
 */

import MapboxRN from "@rnmapbox/maps"
import { View } from "react-native"
import type { MarkerProps } from "./types"

/**
 * Native marker component that wraps MapboxRN.MarkerView
 * Only contains platform-specific code
 */
export const Marker = ({
  longitude,
  latitude,
  children,
}: MarkerProps) => {
  return (
    <MapboxRN.MarkerView
      coordinate={[longitude, latitude]}
      anchor={{ x: 0.5, y: 0.5 }}
      allowOverlap={true}
    >
      <View>{children}</View>
    </MapboxRN.MarkerView>
  )
}
```

**Example: Marker.web.tsx (Web)**
```typescript
/**
 * Web marker component for vessel
 * Wraps react-map-gl Marker to abstract platform differences
 */

import { Marker as MapboxMarker } from "react-map-gl/mapbox"
import { View } from "react-native"
import type { MarkerProps } from "./types"

/**
 * Web marker component that wraps react-map-gl Marker
 * Only contains platform-specific code
 */
export const Marker = ({
  longitude,
  latitude,
  children,
}: MarkerProps) => {
  return (
    <MapboxMarker longitude={longitude} latitude={latitude} anchor="center">
      <View>{children}</View>
    </MapboxMarker>
  )
}
```

### 3. Shared Types File

Create a `types.ts` file that:
- Defines common interfaces used by both platform implementations
- Exports types for consumers of the module
- Keeps type definitions in one place to ensure consistency

**Example: types.ts**
```typescript
/**
 * Type definitions for MapVesselMarkers component
 * Contains all interfaces and types used across MapVesselMarkers module
 */

/**
 * Props for Marker component
 * Identical for both native and web implementations
 */
export interface MarkerProps {
  /** Longitude coordinate */
  longitude: number
  /** Latitude coordinate */
  latitude: number
  /** Callback when marker is pressed */
  onPress: () => void
  /** Marker content to render */
  children: React.ReactNode
}
```

### 4. Index File

Create an `index.ts` file that exports:
- Main component only
- Platform-specific components and types are internal implementation details

**Example: index.ts**
```typescript
/**
 * MapVesselMarkers module exports
 * Exports main component from MapVesselMarkers module
 */

// Main component
export { MapVesselMarkers } from "./MapVesselMarkers"
```

## Benefits of This Pattern

1. **Maximum Code Reuse**: Shared logic is in one place, not duplicated
2. **Clean Platform Separation**: Only platform-specific code is in platform files
3. **Type Safety**: Shared interfaces ensure consistency between platforms
4. **Maintainability**: Changes to visual appearance only need to be made in one place
5. **Bundle Size Optimization**: Bundler only includes code for target platform
6. **Developer Experience**: Clear structure makes code easier to understand and modify

## Common Use Cases

This pattern is ideal for:
- UI components with different implementations on web vs native
- Components wrapping platform-specific libraries (maps, media players, etc.)
- Components requiring different event handling between platforms
- Components with shared business logic but platform-specific rendering

## Implementation Checklist

When implementing this pattern:

- [x] Create main component with shared logic
- [x] Create native implementation file (.tsx)
- [x] Create web implementation file (.web.tsx)
- [x] Create shared types file
- [x] Create index file for exports
- [x] Verify identical interfaces between platforms
- [x] Test on both platforms if possible

## Final Implementation Notes

### Key Insights from MapVesselMarkers Implementation

1. **Platform-Specific Library Constraints**: Sometimes platform libraries have specific prop requirements that may require minimal wrapper components (e.g., View wrapper for MapboxRN.MarkerView)

2. **Type Safety is Critical**: Always ensure props match between platform implementations and usage sites to avoid compile-time errors

3. **Minimal Platform Code**: Platform files should contain only what's necessary for that platform, even if it means adding a minimal wrapper

4. **Shared Logic Centralization**: All business logic, state management, and event handling should be in the main component

5. **Clean Public API**: Index file should only export what consumers need, keeping implementation details private

This pattern provides a robust foundation for building cross-platform React Native applications with maximum code reuse and maintainability.
