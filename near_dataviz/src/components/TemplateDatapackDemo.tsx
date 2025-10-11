'use client'

import React, { useEffect, useState } from 'react'
import { 
  getDpAgeDistributionTemplateData, 
  testDpAgeDistributionTemplate,
  getAgeDistributionStats,
  type AgeDistributionResult 
} from '~/lib/datapacks/DpAgeDistributionTemplate'

const TemplateDatapackDemo: React.FC = () => {
  const [quartierData, setQuartierData] = useState<AgeDistributionResult | null>(null)
  const [suData, setSuData] = useState<AgeDistributionResult | null>(null)
  const [stats, setStats] = useState<{
    totalIndividualAnswers: number
    uniqueSUs: number
    quartierDataPoints: number
    ageCategories: number
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const loadTemplateData = async () => {
    setLoading(true)
    try {
      console.log('🚀 Chargement des données du template...')
      
      // Charger les statistiques
      const statsResult = await getAgeDistributionStats()
      setStats(statsResult)
      
      // Charger les données quartier
      const quartierResult = await getDpAgeDistributionTemplateData()
      setQuartierData(quartierResult)
      
      // Charger les données pour SU 477
      const suResult = await getDpAgeDistributionTemplateData([477])
      setSuData(suResult)
      
      // Lancer les tests
      await testDpAgeDistributionTemplate()
      
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTemplateData()
  }, [])

  const renderDistribution = (data: AgeDistributionResult, title: string) => (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 className="text-xl font-bold mb-4 flex items-center">
        {data.questionLabels.emoji} {title}
        <span className="ml-2 text-sm font-normal text-gray-500">
          ({data.totalResponses} réponses • {data.dataSource})
        </span>
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {data.data.map((item) => (
          <div 
            key={item.value}
            className="p-4 rounded-lg border-2 text-white text-center"
            style={{ backgroundColor: item.color }}
          >
            <div className="text-2xl mb-2">{item.emoji}</div>
            <div className="font-semibold text-sm">{item.label}</div>
            <div className="text-lg font-bold">{item.percentage.toFixed(1)}%</div>
            <div className="text-xs opacity-90">({item.count})</div>
          </div>
        ))}
      </div>
      
      <div className="text-sm text-gray-600">
        <strong>Question:</strong> {data.questionLabels.questionOrigin}<br/>
        <strong>Couleur principale:</strong> <span className="inline-block w-4 h-4 rounded ml-1" style={{ backgroundColor: data.color }}></span> {data.color}
        {data.suId && <><br/><strong>SU ID:</strong> {data.suId}</>}
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">
        📊 Démonstration du Template Datapack - Distribution des âges
      </h1>
      
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Chargement des données réelles...</p>
        </div>
      )}
      
      {stats && (
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">📈 Statistiques des données</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><strong>Réponses individuelles:</strong> {stats.totalIndividualAnswers}</div>
            <div><strong>SUs uniques:</strong> {stats.uniqueSUs}</div>
            <div><strong>Points de données quartier:</strong> {stats.quartierDataPoints}</div>
            <div><strong>Catégories d&apos;âge:</strong> {stats.ageCategories}</div>
          </div>
        </div>
      )}
      
      {quartierData && renderDistribution(quartierData, 'Distribution Quartier (Données INSEE)')}
      
      {suData && renderDistribution(suData, `Distribution SU ${suData.suId} (Réponses individuelles)`)}
      
      <div className="bg-gray-50 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">🔍 Comment ça marche</h2>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li><strong>Vue Quartier:</strong> Utilise les données agrégées INSEE de Quartiers.json (P21_Pop1529_Sum, etc.)</li>
          <li><strong>Vue SU:</strong> Calcule à partir des réponses individuelles de Su Answer.json</li>
          <li><strong>Métadonnées:</strong> Labels et emojis depuis MetaSuQuestions.json et MetaSuChoices.json</li>
          <li><strong>Cache:</strong> Données mises en cache côté client pendant 1 heure</li>
          <li><strong>Couleurs:</strong> Récupérées depuis Su Bank.json selon la SU/quartier</li>
        </ul>
      </div>
    </div>
  )
}

export default TemplateDatapackDemo