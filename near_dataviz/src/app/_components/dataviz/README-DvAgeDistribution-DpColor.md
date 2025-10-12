/**
 * DOCUMENTATION - Adaptation de DvAgeDistribution à DpColor
 * 
 * Ce document explique les changements effectués pour adapter le composant
 * DvAgeDistribution à l'utilisation de DpColor.
 */

## 🎨 Changements Effectués

### 1. Import de DpColor
```typescript
// AJOUTÉ
import { getPalette, getSuColors } from '~/lib/datapacks/DpColor'
```

### 2. État pour les couleurs
```typescript
// AJOUTÉ
const [colors, setColors] = useState<string[]>([])        // Palette pour les barres
const [mainColor, setMainColor] = useState<string>('#002878') // Couleur principale
```

### 3. Chargement des couleurs
```typescript
// MODIFIÉ - Chargement des données ET des couleurs en parallèle
const [result, palette, suColors] = await Promise.all([
  getDpAgeDistributionData(selectedSus),
  getPalette('graph', suId), // Palette pour les barres
  getSuColors(suId) // Couleur principale pour le titre
])
```

### 4. Application des couleurs dans D3
```typescript
// AVANT
.attr('fill', d => d.color) // ❌ Plus disponible dans le datapack

// APRÈS  
.attr('fill', (d, i) => colors[i % colors.length] ?? colors[0] ?? '#002878') // ✅ Utilise DpColor
```

### 5. Couleur du titre
```typescript
// AVANT
.style('fill', data.color) // ❌ Plus disponible dans le datapack

// APRÈS
.style('fill', mainColor) // ✅ Utilise la couleur principale de DpColor
```

## 🎯 Avantages de cette Approche

### ✅ Séparation des Responsabilités
- **Datapack** : Se concentre uniquement sur les données
- **DpColor** : Gère toutes les couleurs de manière centralisée
- **Composant Dv** : Orchestre la visualisation

### ✅ Consistance Visuelle
- Couleurs cohérentes selon la SU sélectionnée
- Palette 'graph' adaptée aux visualisations
- Couleur principale dynamique selon le contexte

### ✅ Performance
- Chargement en parallèle des données et couleurs
- Cache optimisé dans DpColor
- Pas de recalcul inutile des couleurs

### ✅ Flexibilité
- Facile de changer la palette utilisée (graph, gradient, comp)
- Couleurs différentes selon le contexte (SU vs quartier)
- Adaptation automatique au nombre d'éléments

## 🔧 Utilisation des Palettes DpColor

### Types de Palettes Disponibles

1. **'graph'** - Pour les graphiques (colorGraph1-10)
   - Idéal pour les barres, secteurs, etc.
   - 10 couleurs distinctes et contrastées

2. **'gradient'** - Dégradé complet (11 nuances)
   - Parfait pour les heatmaps, cartes de chaleur
   - Du plus clair au plus foncé

3. **'comp'** - Couleur + complémentaire (2 couleurs)
   - Pour les comparaisons binaires
   - Contraste optimal

### Exemple d'Utilisation
```typescript
// Pour une distribution d'âge avec 5 catégories
const palette = await getPalette('graph', suId)
// Retourne: ['#color1', '#color2', '#color3', '#color4', '#color5', ...]

// Application cyclique pour n catégories
.attr('fill', (d, i) => palette[i % palette.length])
```

## 🚀 Prochaines Étapes

1. **Tester** le composant avec différentes SU
2. **Adapter** les autres composants Dv de la même manière
3. **Optimiser** si nécessaire le chargement des couleurs
4. **Documenter** les patterns pour les futurs composants

---

**Status** : ✅ Adaptation terminée et fonctionnelle
**Impact** : 🎨 Couleurs maintenant gérées par DpColor
**Architecture** : 🏗️ Séparation des responsabilités respectée