# DpMobilityByZone - Structure des données

## Vue d'ensemble

Le datapack `DpMobilityByZone` a été restructuré pour différencier les zones par **distance temporelle** (proche/loin) afin de permettre une visualisation détaillée de la mobilité.

## Structure des zones

### Zones retournées

Le datapack retourne maintenant les zones suivantes :

1. **Quartier** - Zone centrale (pas de différenciation proche/loin)
2. **Nord_proche** - Zone Nord à moins de 30 minutes
3. **Nord_loin** - Zone Nord à 30 minutes ou plus
4. **Sud_proche** - Zone Sud à moins de 30 minutes
5. **Sud_loin** - Zone Sud à 30 minutes ou plus
6. **Est_proche** - Zone Est à moins de 30 minutes
7. **Est_loin** - Zone Est à 30 minutes ou plus
8. **Ouest_proche** - Zone Ouest à moins de 30 minutes
9. **Ouest_loin** - Zone Ouest à 30 minutes ou plus
10. **Porte_proche** - Porte d'Orléans à moins de 30 minutes
11. **Porte_loin** - Porte d'Orléans à 30 minutes ou plus

### Critères temporels

- **Proche** (< 30 min) : `LESS_THAN_10_MIN`, `BETWEEN_10_AND_20_MIN`, `BETWEEN_20_AND_30_MIN`
- **Loin** (>= 30 min) : `BETWEEN_30_AND_45_MIN`, `BETWEEN_45_MIN_AND_1_HOUR`, `MORE_THAN_1_HOUR`

## Structure de données par zone

Chaque zone contient :

```typescript
{
  destination: string,  // Ex: "Vers Nord"
  modes: {
    unit: '%',
    foot: { label: 'Piéton', value: number },      // % d'utilisation du mode piéton
    bike: { label: 'Vélo', value: number },        // % d'utilisation du vélo
    car: { label: 'Voiture, moto', value: number }, // % d'utilisation de la voiture
    transit: { label: 'Bus, tram, métro', value: number } // % d'utilisation des transports
  },
  usages: {
    unit: '%',
    leisure: { label: 'Sorties, sports, loisirs', value: number },  // % pour loisirs
    shopping: { label: 'Courses alimentaires', value: number },     // % pour courses
    work: { label: 'Travail, études', value: number }               // % pour travail
  }
}
```

## Utilisation pour la visualisation

### Pour les paths (stroke-width)

Les `modes` de chaque zone doivent être utilisés pour variabiliser l'épaisseur (`stroke-width`) des chemins entre le quartier central et chaque destination :

```typescript
// Exemple pour Nord_proche
const strokeWidthFoot = calculateStrokeWidth(data['Nord_proche'].modes.foot.value) // value en %
const strokeWidthBike = calculateStrokeWidth(data['Nord_proche'].modes.bike.value)
const strokeWidthCar = calculateStrokeWidth(data['Nord_proche'].modes.car.value)
const strokeWidthTransit = calculateStrokeWidth(data['Nord_proche'].modes.transit.value)
```

### Pour les cercles de destination

Le `stroke-width` des cercles de destination peut être basé sur la moyenne ou la somme des modes :

```typescript
const avgMode = (foot + bike + car + transit) / 4
const circleStrokeWidth = calculateStrokeWidth(avgMode)
```

### Pour les icônes d'usage (taille)

Les `usages` de chaque zone doivent être utilisés pour variabiliser la taille des icônes à l'intérieur de chaque cercle de destination :

```typescript
// Exemple pour Nord_proche
const iconSizeLeisure = calculateIconSize(data['Nord_proche'].usages.leisure.value)   // value en %
const iconSizeShopping = calculateIconSize(data['Nord_proche'].usages.shopping.value)
const iconSizeWork = calculateIconSize(data['Nord_proche'].usages.work.value)
```

## Filtrage par Su

Le datapack supporte le filtrage par Su (unité spatiale) :

```typescript
// Vue quartier (agrégée avec pondération par population)
const quartierData = fetchMobilityByZoneData()

// Vue Su spécifique
const su1Data = fetchMobilityByZoneData([1])

// Multiple Sus = retourne vue quartier
const multiSuData = fetchMobilityByZoneData([1, 2, 3])
```

## Mapping des données sources

### Zones sources → Zones finales
 __________________________________________________
| Zone source | Base     | Temps    | Zone finale  |
|-------------|----------|----------|--------------|
| ZONE_A      | Quartier | -        | Quartier     |
| ZONE_B      | Nord     | < 30min  | Nord_proche  |
| ZONE_B      | Nord     | >= 30min | Nord_loin    |
| ZONE_C      | Nord     | < 30min  | Nord_proche  |
| ZONE_C      | Nord     | >= 30min | Nord_loin    |
| ZONE_D      | Sud      | < 30min  | Sud_proche   |
| ZONE_D      | Sud      | >= 30min | Sud_loin     |
| ZONE_E      | Est      | < 30min  | Est_proche   |
| ZONE_E      | Est      | >= 30min | Est_loin     |
| ZONE_F      | Ouest    | < 30min  | Ouest_proche |
| ZONE_F      | Ouest    | >= 30min | Ouest_loin   |
| ZONE_PORTE_ | Porte    | < 30min  | Porte_proche |
| ZONE_PORTE_ | Porte    | >= 30min | Porte_loin   |
 --------------------------------------------------

A=Nord
B=Est
C=Sud
D=Ouest

### Modes de transport

| Mode source | Mode final |
|-------------|------------|
| WALKING | foot |
| PERSONAL_BICYCLE | bike |
| SHARED_BICYCLE | bike |
| PUBLIC_TRANSPORT | transit |
| CAR | car |
| ELECTRIC_CAR | car |
| TAXI_VTC | car |
| NONE_I_DONT_MOVE | foot |

### Usages

| Usage source | Usage final |
|--------------|-------------|
| Hobby | leisure |
| Food | shopping |
| Work | work |

## Prochaines étapes

1. **Intégrer le SVG** dans `_components/dataviz/MobilityHyperGraph/`
2. **Variabiliser le SVG** en fonction des valeurs du datapack :
   - `stroke-width` des paths basé sur `modes.*.value`
   - `stroke-width` des cercles basé sur moyenne des modes
   - Taille des icônes d'usage basée sur `usages.*.value`
3. **Connecter DvMobilityByZone** au nouveau composant SVG
4. **Tester** avec différents filtres de Su
