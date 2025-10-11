// 🎨 Exemple d'utilisation flexible des couleurs dans une Dv
import { getColorsByNames, getColorByName, type SuColors } from '../datapacks/DpSuColors';

// Exemple 1: Choisir des couleurs spécifiques par nom
function ExempleCouleursGraphiques(suId: number) {
  const couleurs = getColorsByNames(['colorGraph1', 'colorGraph5', 'colorGraph8'], suId);
  // Résultat: ['#6E6EB9', '#FFDCE6', '#00A1FF'] pour le quartier
}

// Exemple 2: Choisir une couleur principale
function ExempleCouleurPrincipale(suId: number) {
  const couleurPrincipale = getColorByName('colorMain', suId);
  // Résultat: '#002878' pour le quartier
}

// Exemple 3: Créer une palette personnalisée
function ExemplePalettePersonnalisee(suId: number) {
  const paletteViolets: (keyof SuColors)[] = ['colorDark1', 'colorDark3', 'colorLight2', 'colorComp1'];
  const couleurs = getColorsByNames(paletteViolets, suId);
  // Palette personnalisée adaptée au style de la SU
}

// Exemple 4: Couleurs pour différents types de graphiques
function ExempleCouleursParTypeGraphique(suId: number) {
  // Pour un graphique à barres
  const couleursBarres = getColorsByNames(['colorLight1', 'colorLight3', 'colorDark2', 'colorDark4'], suId);
  
  // Pour un graphique circulaire 
  const couleursCamembert = getColorsByNames(['colorGraph1', 'colorGraph3', 'colorGraph5', 'colorGraph7'], suId);
  
  // Pour des indicateurs
  const couleursIndicateurs = getColorsByNames(['colorComp1', 'colorComp2', 'colorMain'], suId);
}

// Exemple 5: Combinaison de couleurs thématiques
function ExempleCouleursThematiques(suId: number) {
  // Thème "dégradé sombre"
  const themeSombre = getColorsByNames(['colorDark1', 'colorDark2', 'colorDark3', 'colorDark4'], suId);
  
  // Thème "dégradé clair"
  const themeClair = getColorsByNames(['colorLight1', 'colorLight2', 'colorLight3', 'colorLight4'], suId);
  
  // Thème "contrasté"
  const themeContraste = getColorsByNames(['colorMain', 'colorComp1', 'colorDark5', 'colorLight5'], suId);
}

export default function ExempleUsageCouleursFlexible() {
  return (
    <div>
      <h3>🎨 Exemples d'usage flexible des couleurs</h3>
      <p>Dans votre Dv, vous pouvez maintenant choisir n'importe quelle couleur par nom :</p>
      <ul>
        <li><strong>colorMain, colorDark1-5, colorLight1-5</strong> : Palette principale</li>
        <li><strong>colorComp1-2</strong> : Couleurs complémentaires</li>
        <li><strong>colorGraph1-10</strong> : Palette graphique étendue</li>
      </ul>
      <p>Chaque SU/Quartier a ses couleurs spécifiques, automatiquement appliquées selon le contexte !</p>
    </div>
  );
}