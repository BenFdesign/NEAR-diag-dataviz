// Demographie Board - Age and demographic analysis
import DvAgeDistribution3 from '~/components/dataviz/DvAgeDistribution3'
import type { Board } from '~/lib/types'

export const DemographieBoard: Board = {
  id: 'demographie',
  name: 'Démographie',
  emoji: '📊',
  description: 'Analyse démographique et répartition par âge',
  renderComponent: ({ selectedSus, containerWidth, containerHeight }: {
    selectedSus?: number[]
    containerWidth?: number
    containerHeight?: number
  }) => (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-gray-700">
        👥 Analyse Démographique
      </h2>
      
      <div className="bg-white rounded-lg shadow-lg p-4">
        <DvAgeDistribution3 
          selectedSus={selectedSus}
          containerWidth={(containerWidth ?? 800) - 40} // Account for padding
          containerHeight={(containerHeight ?? 600) - 120} // Account for header + padding
        />
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Analyse :</strong> Distribution par tranche d&apos;âge
          {selectedSus && selectedSus.length === 1 
            ? ` pour la SU #${selectedSus[0]}`
            : ' pour l\'ensemble du quartier'
          }
        </p>
      </div>
    </div>
  )
}

export default DemographieBoard