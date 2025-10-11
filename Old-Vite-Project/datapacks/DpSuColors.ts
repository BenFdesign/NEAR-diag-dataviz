import suBankData from '../data/Su Bank.json';

export interface SuColors {
  colorMain: string;
  colorDark1: string;
  colorDark2: string;
  colorDark3: string;
  colorDark4: string;
  colorDark5: string;
  colorLight1: string;
  colorLight2: string;
  colorLight3: string;
  colorLight4: string;
  colorLight5: string;
  colorComp1: string;
  colorComp2: string;
  colorGraph1: string;
  colorGraph2: string;
  colorGraph3: string;
  colorGraph4: string;
  colorGraph5: string;
  colorGraph6: string;
  colorGraph7: string;
  colorGraph8: string;
  colorGraph9: string;
  colorGraph10: string;
}

interface ColorData {
  suColors: Map<number, SuColors>;
  quartierColors: SuColors;
  lastComputed: number; // Timestamp du calcul
}

let colorCache: ColorData | null = null;

const getColorData = (): ColorData => {
  if (!colorCache) {
    colorCache = precomputeColorData();
  }
  return colorCache;
};

// Fonction de pré-calcul des couleurs (suit les principes du document)
const precomputeColorData = (): ColorData => {
  const suColors = new Map<number, SuColors>();
  let quartierColors: SuColors = {
    colorMain: '#002878',
    colorDark1: '#001F60', 
    colorDark2: '#001748',
    colorDark3: '#000F30',
    colorDark4: '#000818',
    colorDark5: '#000410',
    colorLight1: '#003599',
    colorLight2: '#3355BB',
    colorLight3: '#6677DD',
    colorLight4: '#99AAFF',
    colorLight5: '#CCD9FF',
    colorComp1: '#FFD700',
    colorComp2: '#FFF0AA',
    colorGraph1: '#6E6EB9',
    colorGraph2: '#96E6B4',
    colorGraph3: '#00BE8C',
    colorGraph4: '#FFB4C8',
    colorGraph5: '#FFDCE6',
    colorGraph6: '#FF9B9B',
    colorGraph7: '#FF3228',
    colorGraph8: '#00A1FF',
    colorGraph9: '#FF8C00',
    colorGraph10: '#8C00FF'
  };
  
  // Pré-calcul pour toutes les SUs individuelles
  suBankData.forEach(su => {
    const colors: SuColors = {
      colorMain: su.colorMain || '#666',
      colorDark1: su.colorDark1 || '#555',
      colorDark2: su.colorDark2 || '#444', 
      colorDark3: su.colorDark3 || '#333',
      colorDark4: su.colorDark4 || '#222',
      colorDark5: su.colorDark5 || '#111',
      colorLight1: su.colorLight1 || '#888',
      colorLight2: su.colorLight2 || '#999',
      colorLight3: su.colorLight3 || '#aaa',
      colorLight4: su.colorLight4 || '#bbb',
      colorLight5: su.colorLight5 || '#ccc',
      colorComp1: su.colorComp1 || '#ffcc00',
      colorComp2: su.colorComp2 || '#ffe066',
      colorGraph1: su.colorGraph1 || '#1f77b4',
      colorGraph2: su.colorGraph2 || '#ff7f0e',
      colorGraph3: su.colorGraph3 || '#2ca02c',
      colorGraph4: su.colorGraph4 || '#d62728',
      colorGraph5: su.colorGraph5 || '#9467bd',
      colorGraph6: su.colorGraph6 || '#8c564b',
      colorGraph7: su.colorGraph7 || '#e377c2',
      colorGraph8: su.colorGraph8 || '#7f7f7f',
      colorGraph9: su.colorGraph9 || '#bcbd22',
      colorGraph10: su.colorGraph10 || '#17becf'
    };
    
    if (su.Id === 0) {
      quartierColors = colors; // Couleurs quartier
    } else {
      suColors.set(su.Id, colors); // Couleurs par SU ID
    }
  });
  
  return {
    suColors,
    quartierColors,
    lastComputed: Date.now() // Timestamp du calcul
  };
};

// Get colors for a specific SU
export function getSuColors(suId: number): SuColors {
  const colorData = getColorData();
  
  if (suId === 0) {
    return colorData.quartierColors;
  }
  
  return colorData.suColors.get(suId) || colorData.quartierColors;
}

// Get quartier colors
export function getQuartierColors(): SuColors {
  const colorData = getColorData();
  return colorData.quartierColors;
}

// Get color palette for categories (uses colorLight1, colorLight2, colorDark3, colorDark4)
export function getCategoryColors(suId?: number): string[] {
  const colors = suId !== undefined ? getSuColors(suId) : getQuartierColors();
  
  return [
    colors.colorLight1,
    colors.colorLight2, 
    colors.colorDark3,
    colors.colorDark4
  ];
}

// Get specific color by name for a SU/Quartier
export function getColorByName(colorName: keyof SuColors, suId?: number): string {
  const colors = suId !== undefined ? getSuColors(suId) : getQuartierColors();
  return colors[colorName];
}

// Get multiple colors by names for a SU/Quartier
export function getColorsByNames(colorNames: (keyof SuColors)[], suId?: number): string[] {
  const colors = suId !== undefined ? getSuColors(suId) : getQuartierColors();
  return colorNames.map(colorName => colors[colorName]);
}

// Fonction utilitaire pour vider le cache (développement) - suit les principes
export function clearColorCache() {
  colorCache = null;
  console.log('Cache des couleurs vidé');
}