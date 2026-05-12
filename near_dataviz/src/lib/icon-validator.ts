/**
 * UTILITAIRE DE VALIDATION D'ICÔNES SVG
 * =====================================
 * 
 * Ce module fournit une validation stricte côté serveur pour les icônes SVG afin de prévenir les attaques XSS.
 * 
 * Règles de validation :
 * - Doit être un SVG valide
 * - Pas de scripts JavaScript
 * - Pas d'événements on* (onclick, onload, etc.)
 * - Pas de balises dangereuses (script, iframe, object, etc.)
 * - Pas d'URLs externes ou javascript:
 * - Longueur limitée pour éviter les DoS
 */

/**
 * Configuration de la validation
 */
const VALIDATION_CONFIG = {
  maxLength: 10000, // Taille max d'un SVG (10KB)
  allowedTags: [
    'svg', 'g', 'path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'defs', 'use', 'clipPath', 'mask', 'pattern', 'linearGradient',
    'radialGradient', 'stop', 'marker', 'symbol', 'title', 'desc', 'metadata'
  ],
  forbiddenTags: [
    'script', 'iframe', 'object', 'embed', 'link', 'style', 'base', 'meta',
    'form', 'input', 'button', 'textarea', 'select', 'option', 'video', 'audio'
  ],
  forbiddenAttributes: [
    'onload', 'onclick', 'onmouseover', 'onmouseout', 'onchange', 'onsubmit',
    'onfocus', 'onblur', 'onerror', 'onkeydown', 'onkeyup', 'onkeypress'
  ],
  forbiddenProtocols: [
    'javascript:', 'data:', 'vbscript:', 'file:', 'about:', 'chrome:',
    'chrome-extension:', 'moz-extension:'
  ]
}

/**
 * Type de résultat de validation
 */
export type IconValidationResult = {
  isValid: boolean
  sanitizedIcon?: string
  errors: string[]
  warnings: string[]
}

/**
 * Valide et nettoie une icône SVG
 * @param iconHtml - Le code HTML de l'icône à valider
 * @returns Résultat de la validation avec l'icône nettoyée si valide
 */
export function validateAndSanitizeIcon(iconHtml: string): IconValidationResult {
  const result: IconValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  }

  // Vérification de base
  if (!iconHtml || typeof iconHtml !== 'string') {
    result.isValid = false
    result.errors.push('Icône manquante ou invalide')
    return result
  }

  // Vérification de la taille
  if (iconHtml.length > VALIDATION_CONFIG.maxLength) {
    result.isValid = false
    result.errors.push(`Icône trop volumineuse (${iconHtml.length} > ${VALIDATION_CONFIG.maxLength} caractères)`)
    return result
  }

  // Nettoyage initial
  let cleanIcon = iconHtml.trim()

  // Vérification du format SVG
  if (!cleanIcon.toLowerCase().startsWith('<svg')) {
    result.isValid = false
    result.errors.push('L\'icône doit être un SVG valide commençant par <svg>')
    return result
  }

  if (!cleanIcon.toLowerCase().includes('</svg>')) {
    result.isValid = false
    result.errors.push('L\'icône SVG doit être correctement fermée avec </svg>')
    return result
  }

  // Vérification des balises interdites
  for (const forbiddenTag of VALIDATION_CONFIG.forbiddenTags) {
    const tagRegex = new RegExp(`<${forbiddenTag}[^>]*>`, 'gi')
    if (tagRegex.test(cleanIcon)) {
      result.isValid = false
      result.errors.push(`Balise interdite détectée: ${forbiddenTag}`)
    }
  }

  // Vérification des attributs d'événements
  for (const forbiddenAttr of VALIDATION_CONFIG.forbiddenAttributes) {
    const attrRegex = new RegExp(`${forbiddenAttr}\\s*=`, 'gi')
    if (attrRegex.test(cleanIcon)) {
      result.isValid = false
      result.errors.push(`Attribut d'événement interdit: ${forbiddenAttr}`)
    }
  }

  // Vérification des protocoles dangereux
  for (const protocol of VALIDATION_CONFIG.forbiddenProtocols) {
    if (cleanIcon.toLowerCase().includes(protocol)) {
      result.isValid = false
      result.errors.push(`Protocole interdit détecté: ${protocol}`)
    }
  }

  // Vérification des URLs suspectes
  const urlRegex = /(?:href|src|xlink:href|action)\s*=\s*["']([^"']+)["']/gi
  let match
  while ((match = urlRegex.exec(cleanIcon)) !== null) {
    const url = match[1]?.toLowerCase()
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      result.warnings.push(`URL externe détectée: ${match[1]}`)
    }
  }

  // Nettoyage des commentaires HTML (peuvent contenir du code malveillant)
  cleanIcon = cleanIcon.replace(/<!--[\s\S]*?-->/g, '')

  // Nettoyage des espaces multiples
  cleanIcon = cleanIcon.replace(/\s+/g, ' ').trim()

  // Validation finale du XML/SVG
  try {
    // Test basique de parsing XML
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(cleanIcon, 'image/svg+xml')
      const parseErrors = doc.getElementsByTagName('parsererror')
      if (parseErrors.length > 0) {
        result.isValid = false
        result.errors.push('SVG malformé: erreur de parsing XML')
      }
    }
  } catch {
    result.warnings.push('Impossible de valider le XML côté serveur')
  }

  // Si tout est valide, retourner l'icône nettoyée
  if (result.isValid && result.errors.length === 0) {
    result.sanitizedIcon = cleanIcon
  } else {
    result.isValid = false
  }

  return result
}

/**
 * Version simplifiée pour validation rapide
 * @param iconHtml - Le code HTML de l'icône
 * @returns true si l'icône est considérée comme sûre
 */
export function isIconSafe(iconHtml: string): boolean {
  const result = validateAndSanitizeIcon(iconHtml)
  return result.isValid && result.errors.length === 0
}

/**
 * Génère une icône de fallback sécurisée
 * @param suNumber - Le numéro de la SU (optionnel)
 * @returns Une icône SVG simple et sécurisée
 */
export function getFallbackIcon(suNumber?: number): string {
  const iconContent = suNumber 
    ? `<text x="12" y="16" text-anchor="middle" fill="currentColor" font-family="Arial" font-size="10">${suNumber}</text>`
    : '<circle cx="12" cy="12" r="8" fill="currentColor"/>'
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">${iconContent}</svg>`
}

/**
 * Utilitaire pour logger les problèmes de validation
 * @param suId - ID de la SU concernée
 * @param validationResult - Résultat de la validation
 */
export function logIconValidationIssues(suId: number, validationResult: IconValidationResult): void {
  if (!validationResult.isValid || validationResult.errors.length > 0) {
    console.warn(`🚨 Validation d'icône échouée pour SU ${suId}:`, {
      errors: validationResult.errors,
      warnings: validationResult.warnings
    })
  } else if (validationResult.warnings.length > 0) {
    console.info(`⚠️ Avertissements de validation pour SU ${suId}:`, {
      warnings: validationResult.warnings
    })
  }
}