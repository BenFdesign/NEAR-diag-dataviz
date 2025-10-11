/**
 * TEST DE LA VALIDATION D'ICÔNES
 * ==============================
 * 
 * Ce fichier test la validation des icônes pour s'assurer
 * que le système de sécurité fonctionne correctement.
 */

import { 
  validateAndSanitizeIcon, 
  isIconSafe, 
  getFallbackIcon 
} from '../lib/icon-validator'

/**
 * Tests de validation d'icônes
 */
export function testIconValidation() {
  console.log('🧪 Tests de validation d\'icônes')
  
  // Test 1: SVG valide
  const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l9 7h-3v8H6V9H3z"/></svg>'
  const result1 = validateAndSanitizeIcon(validSvg)
  console.log('✅ SVG valide:', result1.isValid, result1.errors)
  
  // Test 2: SVG avec script (dangereux)
  const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert("XSS")</script><path d="M12 2l9 7h-3v8H6V9H3z"/></svg>'
  const result2 = validateAndSanitizeIcon(maliciousSvg)
  console.log('❌ SVG avec script:', result2.isValid, result2.errors)
  
  // Test 3: SVG avec onclick (dangereux)
  const onclickSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onclick="alert(\'XSS\')"><path d="M12 2l9 7h-3v8H6V9H3z"/></svg>'
  const result3 = validateAndSanitizeIcon(onclickSvg)
  console.log('❌ SVG avec onclick:', result3.isValid, result3.errors)
  
  // Test 4: SVG avec URL externe
  const externalUrlSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><image href="https://evil.com/malware.png"/></svg>'
  const result4 = validateAndSanitizeIcon(externalUrlSvg)
  console.log('⚠️ SVG avec URL externe:', result4.isValid, result4.warnings)
  
  // Test 5: Chaîne vide
  const result5 = validateAndSanitizeIcon('')
  console.log('❌ Chaîne vide:', result5.isValid, result5.errors)
  
  // Test 6: Pas un SVG
  const notSvg = '<div>Not an SVG</div>'
  const result6 = validateAndSanitizeIcon(notSvg)
  console.log('❌ Pas un SVG:', result6.isValid, result6.errors)
  
  // Test 7: Test des fonctions utilitaires
  console.log('🛡️ IsIconSafe valide:', isIconSafe(validSvg))
  console.log('🛡️ IsIconSafe malveillant:', isIconSafe(maliciousSvg))
  console.log('🎨 Icône de fallback:', getFallbackIcon(1))
  
  console.log('🏁 Tests terminés')
}

/**
 * Test avec de vraies données Su Bank
 */
export async function testWithRealData() {
  try {
    // Import dynamique pour éviter les problèmes de build
    const { getSuInfo } = await import('../lib/su-service')
    
    console.log('🧪 Test avec données réelles Su Bank')
    
    const suInfos = await getSuInfo()
    console.log(`📊 Chargé ${suInfos.length} SUs`)
    
    for (const su of suInfos) {
      const validation = validateAndSanitizeIcon(su.icon)
      
      if (!validation.isValid) {
        console.warn(`⚠️ SU ${su.id} (${su.name}) a une icône non valide:`, validation.errors)
      } else if (validation.warnings.length > 0) {
        console.info(`ℹ️ SU ${su.id} (${su.name}) a des avertissements:`, validation.warnings)
      } else {
        console.log(`✅ SU ${su.id} (${su.name}) icône OK`)
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test avec données réelles:', error)
  }
}