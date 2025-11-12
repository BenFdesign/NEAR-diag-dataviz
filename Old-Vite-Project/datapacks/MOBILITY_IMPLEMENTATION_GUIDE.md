# Mobility Graph Datapack Implementation Guide

## Overview

This guide explains how the `DvMobilityGraph` component works with the custom SVG and how to create the `DpMobilityByZone` datapack to process mobility survey data including gender and age filtering while maintaining SU (Spheres d'Usages) filtration.

## Architecture Understanding

### Data Flow
```
MobilityData.json → DpMobilityByZone.ts → DvMobilityGraph.jsx → customSVG_mobilityMegaGraph.svg
```

### Key Components

1. **MobilityData.json** - Raw survey data with fields:
   - `Su ID`: Sphere d'Usage identifier (477, 478, 479, etc.)
   - `GENDER`: "MAN" | "WOMAN"
   - `AGE`: "FROM_15_TO_29" | "FROM_30_TO_44" | "FROM_45_TO_59" | "FROM_60_TO_74" | "ABOVE_75"
   - `Mode`: Transportation mode (WALKING, PERSONAL_BICYCLE, PUBLIC_TRANSPORT, CAR, etc.)
   - `Zone`: Origin zone (ZONE_A, ZONE_B, ZONE_C, ZONE_D, ZONE_PORTE_ORLEANS)
   - `Destination_Zone`: Destination with distance encoding (ZONE_A_D0, ZONE_A_D1, ZONE_A_D2, ZONE_A_D3, ZONE_A_D4)
   - `Usage`: Purpose of travel ("Food", "Hobby", "Work", "Modal")
   - `Time`: Travel time category

2. **DpMobilityByZone.ts** - Processes raw data into graph-ready format
   - Filters by Survey ID (1 = Porte d'Orléans diagnostic)
   - Applies SU filtering
   - Aggregates by destination zones
   - Calculates percentages for modes and usages
   - Returns structured data matching SVG requirements

3. **DvMobilityGraph.jsx** - React component that:
   - Loads the custom SVG as an `<object>` element
   - Binds data to SVG elements using D3.js
   - Applies dynamic styling (stroke widths, colors, scales)
   - Handles interactivity (tooltips, hover effects)
   - Controls legend interactions

4. **customSVG_mobilityMegaGraph.svg** - Authored SVG with:
   - Pre-designed layout with 9 destination zones
   - Ellipses for transport mode splines (styled via data)
   - Usage pictograms (scaled via data)
   - Mode pictograms and value placeholders
   - Legends for usages and modes

## Destination Zone Distance Mapping

### Distance Categories
- **D0**: Within the neighborhood (< 10 min)
- **D1**: Close proximity (10-20 min)
- **D2**: Medium distance (20-30 min)  
- **D3**: Far distance (30-45 min)
- **D4**: Very far (45+ min)

### Zone Aggregation Strategy
Following the pattern in `mobilityData.js`:
- **Quartier**: `ZONE_PORTE_ORLEANS_D0` (local neighborhood)
- **Nord1** (proche): `ZONE_A_D1`, `ZONE_A_D2`
- **Nord2** (loin): `ZONE_A_D3`, `ZONE_A_D4`
- **Sud1** (proche): `ZONE_B_D1`, `ZONE_B_D2`
- **Sud2** (loin): `ZONE_B_D3`, `ZONE_B_D4`
- **Est1** (proche): `ZONE_C_D1`, `ZONE_C_D2`
- **Est2** (loin): `ZONE_C_D3`, `ZONE_C_D4`
- **Ouest1** (proche): `ZONE_D_D1`, `ZONE_D_D2`
- **Ouest2** (loin): `ZONE_D_D3`, `ZONE_D_D4`

## Datapack Structure

### Expected Output Format

```typescript
{
  Quartier: {
    destination: "Vers quartier",
    usages: {
      unit: "%",
      leisure: { label: "Sorties, sports, loisirs", value: 25 },
      shopping: { label: "Courses alimentaires", value: 35 },
      work: { label: "Travail, études", value: 30 },
      modal: { label: "Rejoindre une gare ou aéroport", value: 10 }
    },
    modes: {
      unit: "%",
      foot: { label: "Piéton", value: 40 },
      bike: { label: "Vélo", value: 20 },
      car: { label: "Voiture, moto", value: 25 },
      transit: { label: "Bus, tram, métro", value: 15 }
    }
  },
  // ... repeat for Nord1, Nord2, Sud1, Sud2, Est1, Est2, Ouest1, Ouest2
}
```

## Implementation Steps

### 1. Filter Data by Survey ID
Always apply `SURVEY_ID = 1` filter as per project standards.

### 2. Apply SU Filtering
- If `selectedSus` is empty or has multiple values: aggregate across all SUs (Quartier view)
- If single SU: filter to that specific SU only
- Use population weights from `Su Data.json` for Quartier calculations

### 3. Zone Aggregation Logic

```typescript
// Mapping Destination_Zone to graph zones
const getGraphZone = (destZone: string): string | null => {
  if (destZone === 'ZONE_PORTE_ORLEANS_D0') return 'Quartier'
  
  // Nord zones
  if (destZone.startsWith('ZONE_A_')) {
    const dist = destZone.split('_')[2]
    if (dist === 'D1' || dist === 'D2') return 'Nord1'  // proche
    if (dist === 'D3' || dist === 'D4') return 'Nord2'  // loin
  }
  
  // Sud zones  
  if (destZone.startsWith('ZONE_B_')) {
    const dist = destZone.split('_')[2]
    if (dist === 'D1' || dist === 'D2') return 'Sud1'
    if (dist === 'D3' || dist === 'D4') return 'Sud2'
  }
  
  // Est zones
  if (destZone.startsWith('ZONE_C_')) {
    const dist = destZone.split('_')[2]
    if (dist === 'D1' || dist === 'D2') return 'Est1'
    if (dist === 'D3' || dist === 'D4') return 'Est2'
  }
  
  // Ouest zones
  if (destZone.startsWith('ZONE_D_')) {
    const dist = destZone.split('_')[2]
    if (dist === 'D1' || dist === 'D2') return 'Ouest1'
    if (dist === 'D3' || dist === 'D4') return 'Ouest2'
  }
  
  return null
}
```

### 4. Mode Mapping

```typescript
const getModeCategory = (mode: string): string | null => {
  const modeUpper = mode.toUpperCase()
  if (modeUpper === 'WALKING') return 'foot'
  if (modeUpper === 'PERSONAL_BICYCLE' || modeUpper === 'VELIB' || modeUpper === 'SHARED_BICYCLE') return 'bike'
  if (modeUpper === 'CAR' || modeUpper === 'MOTORCYCLE' || modeUpper === 'PERSONAL_CAR') return 'car'
  if (modeUpper === 'PUBLIC_TRANSPORT' || modeUpper === 'METRO' || modeUpper === 'BUS' || modeUpper === 'TRAM') return 'transit'
  if (modeUpper === 'NONE_I_DONT_MOVE') return null  // Exclude from calculations
  return null
}
```

### 5. Usage Mapping

```typescript
const getUsageCategory = (usage: string): string | null => {
  if (usage === 'Food') return 'shopping'
  if (usage === 'Hobby') return 'leisure'
  if (usage === 'Work') return 'work'
  if (usage === 'Modal') return 'modal'
  return null
}
```

### 6. Gender & Age Filtering

The datapack should accept optional filters:
```typescript
interface MobilityFilters {
  selectedSus?: number[]
  selectedGenders?: ('MAN' | 'WOMAN')[]
  selectedAges?: ('FROM_15_TO_29' | 'FROM_30_TO_44' | 'FROM_45_TO_59' | 'FROM_60_TO_74' | 'ABOVE_75')[]
}
```

Apply filters sequentially:
1. Survey ID = 1
2. SU filtering (if specified)
3. Gender filtering (if specified)
4. Age filtering (if specified)

### 7. Percentage Calculations

For each zone:
- Count total trips to that zone
- Count trips by each mode
- Count trips by each usage
- Calculate percentages: `(count / total) * 100`
- Ensure percentages sum to ~100% (within 1% tolerance)

### 8. Caching Strategy

Follow the pattern from `DpAgeDistribution.ts`:
```typescript
let precomputedCache: PrecomputedMobilityData | null = null

const getCachedData = (): PrecomputedMobilityData => {
  if (!precomputedCache) {
    precomputedCache = precomputeMobilityData()
  }
  return precomputedCache
}
```

## SVG Integration Details

### Data Binding Keys
The SVG uses these attribute selectors:
- `data-dest`: Destination identifier ("Quartier", "NordProche", "NordLoin", etc.)
- `data-title`: Element titles for selection (e.g., "VoitureValueNordProche", "CoursesPictosQuartier")
- `.mode-spline.mode--{mode}`: Transport mode spline paths
- `.dest-node`: Destination nodes

### SVG Naming Convention
- **Destinations**: Quartier, NordProche, NordLoin, SudProche, SudLoin, EstProche, EstLoin, OuestProche, OuestLoin
- **Modes**: car, transit, bike, foot
- **Usages**: shopping, work, leisure (modal not visualized in current SVG)

### Dynamic Styling
- **Stroke width**: Scaled by mode percentage (0-100% → 0-15px)
- **Pictogram scale**: Scaled by usage percentage using sigmoid curve
- **Colors**: Applied from theme palette based on `vizColors` prop

## Validation & Testing

### Data Validation
```typescript
export const validateMobilityData = (): boolean => {
  // 1. Verify all zones have data
  // 2. Check percentage sums ≈ 100%
  // 3. Validate mode counts
  // 4. Validate usage counts
  // 5. Ensure no negative values
  return allTestsPassed
}
```

### Expected Data Characteristics
- Total trips should be > 0 for Quartier
- Percentages should be 0-100
- Mode percentages should sum to ~100% per zone
- Usage percentages should sum to ~100% per zone

## Performance Considerations

1. **Precomputation**: Calculate all SU combinations at initialization
2. **Caching**: Store computed results, only recalculate on data change
3. **Filtering**: Apply filters on cached data, not raw JSON
4. **Aggregation**: Use Map structures for O(1) lookups

## Error Handling

1. **Missing Data**: Return zero values, don't crash
2. **Invalid SU**: Fall back to Quartier view
3. **Empty Results**: Show appropriate warning messages
4. **Percentage Validation**: Log warnings if sums deviate >1% from 100%

## Integration with Existing Patterns

Follow established conventions:
- Export main function as `getDpMobilityByZoneData(filters?)`
- Export text version as `getDpMobilityByZoneText(filters?)`
- Include validation function
- Include performance testing function
- Include debug info function
- Include cache clearing function

## Next Steps

1. Implement `DpMobilityByZone.ts` following this guide
2. Test with single SU filtering
3. Test with Quartier aggregation
4. Validate percentage calculations
5. Test gender/age filtering
6. Create board component that uses the datapack
7. Integrate with existing dashboard UI

## References

- DpAgeDistribution.ts - Pattern for filtering and caching
- DvMobilityGraph.jsx - SVG binding and styling logic  
- mobilityData.js - Expected output format
- MobilityData.json - Raw data structure
