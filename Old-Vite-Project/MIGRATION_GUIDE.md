# 🚀 **Project Migration Guide: Vite → Next.js T3 Stack**

## 📋 **Project Overview**

### **Current State (Vite)**
A React TypeScript dashboard application for data visualization of a dignaosis, filtered by SU ("Spheres d'Usages") (with interactive boards, filters, and charts. Built with Vite, pure CSS, and JSON data imports.

### **Target State (Next.js T3)**
Migrate to T3 Stack (Next.js, TypeScript, Tailwind CSS) while maintaining standalone functionality for future integration into larger projects.

---

## 🏗️ **Architecture Analysis**

### **Current File Structure**
```
near_dataviz9/
├── src/
│   ├── App.tsx                 # Main application component
│   ├── main.tsx               # Vite entry point
│   ├── index.css              # Global styles
│   ├── App.css                # App-specific styles
│   ├── vite-env.d.ts          # Vite type definitions
│   ├── components/            # React components
│   │   ├── LeftSidebar.tsx    # SU filter menu (recently refactored)
│   │   ├── RightSidebar.tsx   # Board selection menu (newly extracted)
│   │   ├── BoardViewer.tsx    # Main content container
│   │   ├── TopMenu.tsx        # Header component (unused)
│   │   └── LeftSidebarMultiSelect.tsx # Alternative sidebar
│   ├── boards/                # Board containers
│   │   ├── registry.ts        # Board registration system
│   │   ├── SingleViewBoard.tsx # Single visualization display
│   │   ├── FicheSuBoard.tsx   # SU profile board
│   │   ├── ExportBoard.tsx    # Export functionality with html2canvas
│   │   ├── EmdvSatisfactionsBoard.tsx # Satisfaction data board
│   │   ├── EmdvSatisfactionsByCategoryBoard.tsx # Categorized satisfaction
│   │   └── ...                # Additional specialized boards
│   ├── dataviz/               # Visualization components
│   │   ├── DvSuTitle.tsx      # SU title display
│   │   ├── DvEmdvSatisfactions.tsx # Satisfaction charts
│   │   ├── DvSuUsagesViolin.tsx # Usage violin plots
│   │   ├── DvUsageViolin.tsx  # Generic violin plots
│   │   └── ...                # Chart components using D3.js/SVG
│   ├── datapacks/             # Data processing layer
│   │   ├── DpSuTitle.ts       # SU title data processing
│   │   ├── DpEmdvSatisfactions.ts # Satisfaction data processing
│   │   ├── DpEmdvSatisfactionsByCategory.ts # Categorized data
│   │   ├── DpGenderRepartition.ts # Gender distribution
│   │   ├── DpAgeDistribution.ts # Age demographics
│   │   ├── DpTransportationMode.ts # Transport data
│   │   └── ...                # Data transformation utilities
│   ├── services/              # Business logic
│   │   └── suService.ts       # SU data management (recently enhanced)
│   ├── types/                 # TypeScript definitions
│   │   └── index.ts           # All type definitions
│   ├── data/                  # JSON data files (CRITICAL MIGRATION POINT)
│   │   ├── Su Bank.json       # SU metadata (colors, icons, names)
│   │   ├── Su Data.json       # SU population percentages
│   │   ├── Surveys.json       # Survey information
│   │   ├── Quartiers.json     # Neighborhood demographics
│   │   ├── MetaEmdvQuestions.json # EMDV question metadata
│   │   ├── MetaEmdvChoices.json # EMDV choice options
│   │   ├── Way Of Life Answer.json # Lifestyle survey responses
│   │   ├── Carbon Footprint Answer.json # Carbon footprint data
│   │   └── ...                # Additional JSON datasets
│   └── styles/                # CSS modules
│       └── dashboard.css      # Main dashboard layout
├── public/                    # Static assets
├── package.json               # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite configuration
└── index.html                # HTML entry point
```

---

## 🎯 **Core Application Logic**

### **State Management Pattern**
```typescript
// Central state in App.tsx
type MenuState = {
  selectedBoard: string      // Current active board
  selectedSus: number[]      // Selected SU filters (1-9)
  availableSus: SuInfo[]     // All available SUs for current survey
}

// Survey ID filtering (recently implemented)
const SURVEY_ID = 1;  // Porte d'Orléans diagnostic
```

### **Data Flow Architecture**
```
JSON Files → Datapacks → Services → Components → UI
     ↓           ↓          ↓          ↓        ↓
 Raw Data → Processing → Business → React → Display
```

### **Key Business Logic**
1. **SU Service** (`suService.ts`): 
   - Filters data by `SURVEY_ID = 1`
   - Links `Su Bank.json` (metadata) with `Su Data.json` (percentages)
   - Calculates real population from percentages
   - Recently enhanced with population calculations

2. **Board Registry System**:
   - Dynamic board registration
   - Props interface: `{ selectedSus: number[], allSus: SuInfo[] }`
   - Board switching with state preservation

3. **Data Processing Chain**:
   - Datapacks filter/transform raw JSON
   - Caching for performance
   - Type-safe data transformations

---

## 📊 **Data Structure Dependencies**

### **Critical JSON Imports** (⚠️ MAJOR MIGRATION CHALLENGE)
```typescript
// Current Vite imports (WILL BREAK in Next.js)
import suBankData from '../data/Su Bank.json'
import suData from '../data/Su Data.json'
import surveys from '../data/Surveys.json'
import quartiersData from '../data/Quartiers.json'
import metaEmdvQuestionsData from '../data/MetaEmdvQuestions.json'
import metaEmdvChoicesData from '../data/MetaEmdvChoices.json'
import wayOfLifeData from '../data/Way Of Life Answer.json'
import carbonFootprintData from '../data/Carbon Footprint Answer.json'
```

### **Data Relationships**
```
Surveys (ID) ←→ Quartiers (Survey ID) ←→ Population Sum
     ↓
Su Data (Survey ID, Su Bank ID) ←→ Su Bank (Id)
     ↓
EMDV Questions/Choices (Category, Subcategory)
     ↓
Answer Data (filtered by SU selection)
```

---

## 🎨 **UI Components Architecture**

### **Layout System** (CSS Grid-based)
```css
.dashboard {
  grid-template-rows: 70px 1fr 100px;
  grid-template-columns: 0.2fr 0.6fr 0.2fr;
  max-width: removed; /* Recently fixed for full-screen */
}
```

### **Component Hierarchy**
```
App.tsx
├── LeftSidebar (SU filtering)
│   ├── Quartier button (100% population)
│   └── Individual SU buttons (calculated population)
├── RightSidebar (Board selection)
│   └── Board registry buttons
└── BoardViewer
    └── Dynamic Board Component
        └── Multiple Dataviz Components
```

### **Styling Approach**
- **Inline styles** for component-specific styling
- **CSS classes** for layout and reusable patterns
- **CSS Grid** for dashboard layout
- **Color system** from SU Bank metadata

---

## 🔄 **Migration Strategy to T3 Stack**

### **Phase 1: Project Setup**
```bash
# Create T3 app
npx create-t3-app@latest dataviz-dashboard --typescript --tailwind --eslint --app

# Key dependencies to add
npm install d3 @types/d3 html2canvas @types/html2canvas
```

### **Phase 2: File Structure Transformation**

#### **Target Next.js Structure**
```
dataviz-dashboard/
├── src/
│   ├── app/                   # App Router (Next.js 13+)
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Main dashboard page
│   │   └── globals.css        # Global Tailwind styles
│   ├── components/            # Same structure, add Tailwind
│   │   ├── LeftSidebar.tsx    # Convert CSS to Tailwind
│   │   ├── RightSidebar.tsx   # Convert CSS to Tailwind
│   │   ├── BoardViewer.tsx    # Minimal changes
│   │   └── ui/                # Shadcn/ui components (optional)
│   ├── lib/                   # Utilities and configurations
│   │   ├── utils.ts           # Tailwind utilities
│   │   └── data/              # Data access layer (NEW)
│   │       ├── su-service.ts  # Migrated service
│   │       ├── data-loader.ts # JSON loading utilities
│   │       └── types.ts       # Moved from src/types
│   ├── boards/                # Same structure, Tailwind updates
│   ├── dataviz/               # Same structure, minimal changes
│   └── datapacks/             # MAJOR REFACTOR NEEDED
├── public/                    # Move JSON files here
│   ├── data/                  # Relocated from src/data
│   │   ├── su-bank.json       # Renamed (no spaces)
│   │   ├── su-data.json       # Renamed
│   │   ├── surveys.json       # All JSON files
│   │   └── ...
└── tailwind.config.ts         # Tailwind configuration
```

### **Phase 3: Data Loading Migration** (⚠️ CRITICAL)

#### **Strategy A: API Routes** (Recommended)
```typescript
// src/app/api/data/[dataset]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { dataset: string } }
) {
  const filePath = path.join(process.cwd(), 'public', 'data', `${params.dataset}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return NextResponse.json(data);
}

// Usage in components
const suBankData = await fetch('/api/data/su-bank').then(r => r.json());
```

#### **Strategy B: Server Components** (Alternative)
```typescript
// src/lib/data/data-loader.ts
export async function loadSuBankData() {
  const filePath = path.join(process.cwd(), 'public', 'data', 'su-bank.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Usage in server components
const suBankData = await loadSuBankData();
```

### **Phase 4: Component Migration**

#### **App.tsx → page.tsx Transformation**
```typescript
// src/app/page.tsx
import { DashboardWrapper } from '@/components/DashboardWrapper'

export default function HomePage() {
  return <DashboardWrapper />
}

// src/components/DashboardWrapper.tsx
'use client'
import { useState, useMemo } from 'react'
// ... rest of current App.tsx logic
```

#### **CSS → Tailwind Conversion Examples**
```typescript
// BEFORE (inline styles)
style={{
  backgroundColor: isSelected ? su.color : 'white',
  border: `2px solid ${isSelected ? '#e1e5e9' : su.color}`,
  borderRadius: 15,
  padding: '12px 14px'
}}

// AFTER (Tailwind classes)
className={`
  ${isSelected ? 'text-white' : 'text-gray-800'}
  ${isSelected ? 'border-gray-200' : 'border-current'}
  border-2 rounded-2xl px-3.5 py-3
  transition-all duration-500 cursor-pointer
`}
style={{ 
  backgroundColor: isSelected ? su.color : 'white',
  borderColor: isSelected ? '#e1e5e9' : su.color 
}}
```

---

## 🧩 **Component-by-Component Migration Guide**

### **High Priority (Core Functionality)**

#### **1. LeftSidebar.tsx**
- **Current state**: Recently updated with population display
- **Migration**: Convert inline styles to Tailwind classes
- **Data dependency**: `suService.ts` (update data loading)
- **Effort**: Medium

#### **2. RightSidebar.tsx**
- **Current state**: Newly extracted component
- **Migration**: Pure Tailwind conversion
- **Data dependency**: Board registry (no JSON loading)
- **Effort**: Low

#### **3. BoardViewer.tsx**
- **Migration**: Minimal changes, add Tailwind container classes
- **Effort**: Low

### **Medium Priority (Board Components)**

#### **4. All Board Components** (`src/boards/`)
- **Pattern**: Most have minimal data dependencies
- **Migration**: Tailwind styling updates
- **Special case**: `ExportBoard.tsx` uses html2canvas (verify Next.js compatibility)
- **Effort**: Low-Medium per board

### **High Complexity (Data Layer)**

#### **5. All Datapacks** (`src/datapacks/`)
- **Current pattern**: Direct JSON imports
- **Migration strategy**: 
  ```typescript
  // BEFORE
  import data from '../data/file.json'
  
  // AFTER
  async function loadData() {
    const response = await fetch('/api/data/file')
    return response.json()
  }
  ```
- **Impact**: ALL datapacks need refactoring
- **Effort**: High (each datapack needs async/await conversion)

#### **6. suService.ts**
- **Recent changes**: Survey ID filtering, population calculations
- **Migration needs**: Convert JSON imports to API calls
- **Effort**: Medium-High

---

## 🎯 **Migration Checklist**

### **Pre-Migration Preparation**
- [ ] Backup current working version
- [ ] Document all current JSON import locations
- [ ] Test current functionality for regression testing
- [ ] Identify component styling patterns for Tailwind conversion

### **Phase 1: Setup**
- [ ] Create T3 app with TypeScript + Tailwind
- [ ] Move JSON files to `public/data/` with renamed files (no spaces)
- [ ] Set up basic API routes for data loading
- [ ] Configure Tailwind with custom colors from SU metadata

### **Phase 2: Core Migration**
- [ ] Migrate type definitions to `src/lib/types.ts`
- [ ] Convert `App.tsx` to `page.tsx` + `DashboardWrapper`
- [ ] Migrate `suService.ts` with async data loading
- [ ] Update `LeftSidebar` and `RightSidebar` with Tailwind

### **Phase 3: Data Layer**
- [ ] Refactor all datapacks to async/await pattern
- [ ] Implement data loading utilities
- [ ] Add loading states and error handling
- [ ] Test data flow end-to-end

### **Phase 4: Styling & Polish**
- [ ] Convert all inline styles to Tailwind classes
- [ ] Implement responsive design improvements
- [ ] Add loading spinners and error states
- [ ] Verify html2canvas compatibility in Next.js

### **Phase 5: Testing & Optimization**
- [ ] Component functionality testing
- [ ] Performance optimization (data loading, caching)
- [ ] Build and deployment testing
- [ ] Documentation updates

---

## ⚠️ **Critical Migration Points**

### **1. JSON Data Loading** (HIGHEST RISK)
- **Impact**: Breaks every datapack
- **Solution**: API routes + async/await pattern
- **Testing**: Verify all data flows work

### **2. Client vs Server Components**
- **Current**: All client-side rendering
- **Next.js**: Choose client vs server appropriately
- **Recommendation**: Keep interactive components as client components

### **3. Styling System Change**
- **Current**: Mix of inline styles and CSS classes
- **Target**: Tailwind utility classes
- **Strategy**: Gradual conversion, maintain visual consistency

### **4. Build-time vs Runtime**
- **Current**: All data loaded at runtime
- **Next.js options**: Static generation possible for some data
- **Recommendation**: Keep runtime loading for now (simpler migration)

---

## 🚀 **Expected Benefits Post-Migration**

### **Developer Experience**
- Better TypeScript integration
- Tailwind CSS utilities
- Next.js developer tools
- Hot reload improvements

### **Performance**
- Automatic code splitting
- Optimized builds
- Better caching strategies
- Image optimization (if images added later)

### **Future Integration Ready**
- Component-based architecture suitable for larger projects
- API routes ready for external data sources
- Scalable folder structure
- Modern React patterns

---

## 📝 **Implementation Notes for Claude Agent**

### **Key Principles**
1. **Maintain functionality**: Every feature must work post-migration
2. **Gradual conversion**: Migrate in phases to minimize risk
3. **Type safety**: Preserve all TypeScript definitions
4. **Performance**: Don't degrade current performance
5. **Standalone**: Keep as independent component

### **Testing Strategy**
- Test each board after datapack migration
- Verify SU filtering works correctly
- Confirm population calculations are accurate
- Check export functionality with html2canvas

### **Rollback Plan**
- Keep Vite version as backup
- Document all changes for easy rollback
- Test migration on copy before applying to main codebase

---

This migration guide provides comprehensive coverage for transforming the current Vite-based dashboard into a modern T3 Stack application while preserving all functionality and preparing for future integration into larger projects.