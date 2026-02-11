/**
 * Configuration centrale du Survey (diagnostic courant)
 *
 * Pour l'instant, le projet reste monodiagnostic :
 * - CURRENT_SURVEY_ID = 1 correspond à la Porte d'Orléans.
 *
 * À terme, cette constante pourra être remplacée par un contexte global
 * (utilisateur, route, paramètre d'URL, etc.) sans changer les appels
 * des loaders et datapacks qui s'appuient dessus.
 */

export const CURRENT_SURVEY_ID = 1;
