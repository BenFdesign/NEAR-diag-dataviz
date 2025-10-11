/**
 * TEST FINAL DE VALIDATION DES ICÔNES TRANSFORMÉES
 * ===============================================
 * 
 * Vérifie que toutes les icônes corrigées passent maintenant la validation.
 */

import { validateAndSanitizeIcon } from '../lib/icon-validator'

// Test des icônes transformées
const transformedIcons = {
  "Quartier Icon1": `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><path fill="#ffad5a" d="M46.662 19h33.257v90H46.662z"/><path fill="#f9d16e" d="M46.662 109H25.46V39.599h21.202zM79.92 109h22.619V45.667L79.92 39.599V109z"/><path fill="#fff8e3" d="M53.416 28.482h6.355v6.355h-6.355zM66.811 28.482h6.355v6.355h-6.355zM53.416 41.418h6.355v6.355h-6.355zM66.811 41.418h6.355v6.355h-6.355zM53.416 54.354h6.355v6.355h-6.355zM32.884 47.773h6.355v6.355h-6.355zM32.884 62.151h6.355v6.355h-6.355zM32.884 76.528h6.355v6.355h-6.355zM32.884 90.906h6.355v6.355h-6.355zM66.811 54.354h6.355v6.355h-6.355zM87.051 54.354h8.356v4.312h-8.356zM87.051 68.312h8.356v4.312h-8.356zM87.051 82.27h8.356v4.312h-8.356zM87.051 96.228h8.356v4.312h-8.356zM53.416 67.29h6.355v6.355h-6.355zM66.811 67.29h6.355v6.355h-6.355zM53.416 80.227h6.355v6.355h-6.355zM66.811 80.227h6.355v6.355h-6.355zM53.416 93.163h6.355v6.355h-6.355zM66.811 93.163h6.355v6.355h-6.355z"/><path d="M109 110.75H19a1.75 1.75 0 0 1 0-3.5h90a1.75 1.75 0 0 1 0 3.5z" fill="#2d1f5e"/></svg>`,
  
  "Quartier Icon2": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M22 11h-3V2a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v5H2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h20a1 1 0 0 0 1-1V12a1 1 0 0 0-1-1zm-9 1v9H3V9h10zm1-5H7V3h10v8h-2V8a1 1 0 0 0-1-1zm7 14h-2v-2a1 1 0 0 0-2 0v2h-2v-8h6zM4 10h2v2H4zm4 0h4v2H8zm-4 4h2v2H4zm4 0h4v2H8zm-4 4h2v2H4zm4 0h4v2H8z"/></svg>`,
  
  "Myrtille Icon1 (Transformé)": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><g><g><path fill="#707070" d="M929.186 897.537c-103.891 15.98-191.788-7.527-263.207-71.683-68.526-61.557-120.134-160.315-154.334-297.344l-12.324-49.38 50.353 7.398c139.732 20.524 243.097 62.144 311.11 124.267 70.884 64.748 102.941 149.9 97.282 254.858l-34.045-1.818 5.164 33.7z"/><path fill="#707070" d="M1216.7 861.536c84.48-62.544 173.205-82.698 266.29-59.209 89.315 22.54 180.992 85.88 275.098 191.19l33.912 37.95-48 16.916c-133.201 46.943-244.053 58.278-333.177 34.997-92.887-24.262-160.925-84.67-204.821-180.178l30.97-14.254-20.272-27.411z"/><path fill="#999" d="M817.714 705.099c39.957-199.78 234.303-329.344 434.084-289.387 199.78 39.958 329.344 234.304 289.387 434.084-95.165 475.819-818.636 331.122-723.471-144.697z"/><path fill="#767676" d="M1451.7 1033.16c-6.84 7.417-13.896 14.522-21.252 21.154-84.615-69.826-178.775-154.754-284.694-164.301-58.535-5.278-139.734 75.908-214.872 160.91-48.17-40.114-85.87-92.676-105.87-156.26 137.703-229.566 384.656-312.67 499.476-23.987 36.923 92.83 81.247 141.272 127.212 162.484z"/><circle fill="#3e3e3e" cx="656" cy="420" r="91"/><path fill="#373737" d="M961.775 861.008c-25.315-14.778 12.632 83.597 42.302 86.49 29.67 2.894 92.888-85.507 65.147-76.014-37.407 12.801-73.24 9.494-107.45-10.476z"/><path fill="#373737" d="M937.32 777.851c.223-29.126-57.252 56.016-46.696 82.302 10.554 26.286 103.93 30.828 84.919 12.889-25.637-24.189-38.524-55.83-38.223-95.191z"/><circle fill="#535353" cx="997" cy="820" r="27"/></g></g></svg>`,
  
  "Myrtille Icon2 (Transformé)": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M44 31a9 9 0 1 1-16.14-5.47 8.89 8.89 0 0 1 4.28-3.06A8.75 8.75 0 0 1 35 22a9 9 0 0 1 9 9zM16 23l-2 2M16 25l-2-2M22 28a9 9 0 1 1-5.59-8.33h0a9 9 0 0 1 5.18 5.64h0A8.77 8.77 0 0 1 22 28z"/><path fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M34 17a8.92 8.92 0 0 1-1.86 5.47 8.89 8.89 0 0 0-4.28 3.06A8.75 8.75 0 0 1 25 26a9 9 0 0 1-3.41-.67h0a9 9 0 0 0-5.18-5.64h0A8.77 8.77 0 0 1 16 17a9 9 0 0 1 18 0zM28 12l-2 2M28 14l-2-2M34 25l-2 2M34 27l-2-2"/></svg>`,

  "Kiwi Icon1 (Transformé)": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><ellipse cx="24" cy="24" rx="16" ry="20" fill="#5a5a5a"/><ellipse cx="24" cy="24" rx="12" ry="15" fill="#646565"/><ellipse cx="24" cy="24" rx="8" ry="10" fill="#b6b6b6"/><ellipse cx="24" cy="24" rx="6" ry="8" fill="#d3d3d3"/><circle cx="20" cy="20" r="1.5" fill="#4d4d4d"/><circle cx="28" cy="20" r="1.5" fill="#4d4d4d"/><circle cx="24" cy="28" r="1.5" fill="#4d4d4d"/><circle cx="18" cy="30" r="1" fill="#4d4d4d"/><circle cx="30" cy="30" r="1" fill="#4d4d4d"/><circle cx="16" cy="24" r="1" fill="#4d4d4d"/><circle cx="32" cy="24" r="1" fill="#4d4d4d"/><circle cx="22" cy="32" r="1" fill="#4d4d4d"/><circle cx="26" cy="32" r="1" fill="#4d4d4d"/></svg>`
}

export function testTransformedIcons() {
  console.log('🧪 Tests de validation des icônes transformées')
  console.log('=' .repeat(50))

  let allValid = true
  let totalTested = 0
  let totalPassed = 0

  Object.entries(transformedIcons).forEach(([name, icon]) => {
    totalTested++
    console.log(`\n📋 ${name}`)
    console.log('-'.repeat(30))

    const result = validateAndSanitizeIcon(icon)
    
    if (result.isValid && result.errors.length === 0) {
      console.log('✅ VALIDE')
      totalPassed++
    } else {
      console.log('❌ ÉCHEC:', result.errors)
      allValid = false
    }

    if (result.warnings.length > 0) {
      console.log('⚠️ Avertissements:', result.warnings)
    }
  })

  console.log('\n' + '=' .repeat(50))
  console.log(`📊 RÉSULTAT FINAL: ${totalPassed}/${totalTested} icônes validées`)
  
  if (allValid) {
    console.log('🎉 SUCCÈS: Toutes les icônes transformées passent la validation!')
  } else {
    console.log('⚠️ ATTENTION: Certaines icônes nécessitent encore des corrections')
  }

  return allValid
}

// Exécuter le test
if (typeof require !== 'undefined' && require.main === module) {
  testTransformedIcons()
}