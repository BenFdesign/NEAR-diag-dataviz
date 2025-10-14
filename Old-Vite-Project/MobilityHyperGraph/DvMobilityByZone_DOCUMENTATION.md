# DvMobilityByZone - Documentation

## Vue d'ensemble

Le composant `DvMobilityByZone` affiche un graphique SVG interactif de mobilité qui variabilise visuellement les données du `DpMobilityByZone`.

## Variabilisation mise en place

### 1. **Stroke-width des paths** (lignes reliant quartier central → destinations)

Chaque ligne représente un mode de transport et son épaisseur varie selon le pourcentage d'utilisation :

```typescript
strokeWidth={getStrokeWidth(mode.value)}
// value: 0-100% → strokeWidth: 0.5-4px
```

**Mapping:**
- `data[zone].modes.foot.value` → épaisseur ligne piéton
- `data[zone].modes.bike.value` → épaisseur ligne vélo
- `data[zone].modes.transit.value` → épaisseur ligne métro
- `data[zone].modes.car.value` → épaisseur ligne voiture

### 2. **Stroke-width des cercles de destination**

Le contour de chaque cercle de destination varie selon la **moyenne des 4 modes** :

```typescript
const avgMode = (foot + bike + car + transit) / 4
strokeWidth={getStrokeWidth(avgMode, 1, 5)}
// avgMode: 0-100% → strokeWidth: 1-5px
```

### 3. **Stroke-width des cercles quartier central**

Les 4 cercles concentriques autour du quartier central varient selon les valeurs des modes du quartier :

```typescript
<ellipse rx="72.541" strokeWidth={getStrokeWidth(data.Quartier.modes.car.value, 0.5, 3)} />
<ellipse rx="58.939" strokeWidth={getStrokeWidth(data.Quartier.modes.transit.value, 0.5, 3)} />
<ellipse rx="45.338" strokeWidth={getStrokeWidth(data.Quartier.modes.bike.value, 0.5, 3)} />
<ellipse rx="31.737" strokeWidth={getStrokeWidth(data.Quartier.modes.foot.value, 0.5, 3)} />
```

### 4. **Taille des icônes d'usage**

Les cercles représentant les usages varient en taille (rayon) selon les pourcentages :

```typescript
const scale = getIconScale(usage.value)
r={3 * scale}
// value: 0-100% → scale: 0.5-1.5 → radius: 1.5-4.5px
```

**Mapping:**
- `data[zone].usages.leisure.value` → taille icône loisirs
- `data[zone].usages.shopping.value` → taille icône courses
- `data[zone].usages.work.value` → taille icône travail

## Structure des zones

Le SVG affiche **9 zones** :

1. **Quartier** (centre) - Cercle central avec 4 cercles concentriques de modes
2. **Nord_proche** - Destination Nord < 30min
3. **Nord_loin** - Destination Nord >= 30min
4. **Sud_proche** - Destination Sud < 30min
5. **Sud_loin** - Destination Sud >= 30min
6. **Est_proche** - Destination Est < 30min
7. **Est_loin** - Destination Est >= 30min
8. **Ouest_proche** - Destination Ouest < 30min
9. **Ouest_loin** - Destination Ouest >= 30min

## Fonctions de variabilisation

### `getStrokeWidth(value, min, max)`

Convertit un pourcentage (0-100) en épaisseur de trait :

```typescript
const getStrokeWidth = (value: number, min = 0.5, max = 4) => {
  return min + (max - min) * (value / 100)
}
```

**Exemples :**
- `value = 0%` → `0.5px`
- `value = 50%` → `2.25px`
- `value = 100%` → `4px`

### `getIconScale(value, min, max)`

Convertit un pourcentage (0-100) en facteur d'échelle :

```typescript
const getIconScale = (value: number, min = 0.5, max = 1.5) => {
  return min + (max - min) * (value / 100)
}
```

**Exemples :**
- `value = 0%` → `scale = 0.5`
- `value = 50%` → `scale = 1.0`
- `value = 100%` → `scale = 1.5`

## Couleurs dynamiques

Les couleurs s'adaptent selon le Su sélectionné via `DpColor` :

```typescript
const [mainColor, setMainColor] = useState<string>('#186000')     // Couleur principale
const [lightColor3, setLightColor3] = useState<string>('#BADA55')  // Couleur claire
const [darkColor1, setDarkColor1] = useState<string>('#0F3F00')    // Couleur foncée
```

**Mapping des couleurs :**
- `mainColor` → contours, lignes modes, cercles quartier
- `darkColor1` → textes légende
- `lightColor3` → placeholder illustrations

## Positionnement SVG

Les positions des destinations sont fixes dans le viewBox 500x500 :

```typescript
const zonePositions: Record<string, { cx: number; cy: number; name: string }> = {
  'Nord_proche': { cx: 294.174, cy: 116.074, name: 'NordProche' },
  'Nord_loin': { cx: 226.233, cy: 44.137, name: 'NordLoin' },
  'Sud_proche': { cx: 206.047, cy: 380.197, name: 'SudProche' },
  'Sud_loin': { cx: 283.29, cy: 457.083, name: 'SudLoin' },
  'Est_proche': { cx: 386.507, cy: 279.035, name: 'EstProche' },
  'Est_loin': { cx: 457.422, cy: 221.453, name: 'EstLoin' },
  'Ouest_proche': { cx: 114.415, cy: 210.136, name: 'OuestProche' },
  'Ouest_loin': { cx: 56.009, cy: 286.279, name: 'OuestLoin' },
}
```

Quartier central : `cx="250" cy="250"`

## Éléments affichés

### Pour chaque destination (8 cercles)

1. **Cercle de destination** - stroke-width = moyenne des 4 modes
2. **4 lignes de modes** - stroke-width = valeur du mode
3. **4 valeurs de modes** - textes affichant les %
4. **3 icônes d'usage** - cercles de taille variable

### Pour le quartier central

1. **Cercle central** - fixe, 30px de rayon
2. **4 cercles concentriques** - stroke-width variable selon modes
3. **Texte "Quartier"** - label central

### Axes temporels (fond)

1. **Cercle externe** - limite 30+ minutes (pointillés)
2. **Cercle interne** - limite <30 minutes (pointillés)

## Utilisation

```tsx
import DvMobilityByZone from '~/app/_components/dataviz/DvMobilityByZone'

// Vue quartier (agrégée)
<DvMobilityByZone />

// Vue Su spécifique
<DvMobilityByZone selectedSus={[1]} />

// Multi-Su (retourne vue quartier)
<DvMobilityByZone selectedSus={[1, 2, 3]} />
```

## États du composant

- **Loading** : Affiche "Chargement des données de mobilité..."
- **Error** : Affiche "Erreur: [message]"
- **No Data** : Affiche "Aucune donnée disponible"
- **Loaded** : Affiche le SVG variabilisé

## Responsive

Le SVG utilise `viewBox="0 0 500 500"` avec `className="w-full h-auto max-w-full"` pour s'adapter à son conteneur tout en conservant les proportions.

## Prochaines améliorations possibles

1. **Ajouter les pictogrammes réels** au lieu de cercles pour les usages
2. **Ajouter les textes de destination** (noms des quartiers)
3. **Animations** sur les changements de valeurs
4. **Tooltips** interactifs au survol
5. **Légende** pour expliquer les modes et usages
6. **Export SVG** pour réutilisation externe
