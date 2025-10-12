import React from 'react'
import type { BoardProps } from '~/lib/types'
import { DvSuTitle } from '../'

// Board de test simple
const TestBoard: React.FC<BoardProps> = ({ selectedSus, allSus }) => {
  return (
    <div className="p-8 space-y-6">
      {/* SU Title Component */}
      <div className="mb-6">
        <DvSuTitle selectedSus={selectedSus} />
      </div>

      {/* Information Panel */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          Dashboard de test - NEAR Dataviz
        </h2>
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">
            SUs Sélectionnées: {selectedSus.length > 0 ? selectedSus.join(', ') : 'Toutes (vue quartier)'}
          </h3>
          <p className="text-gray-600">
            Total SUs disponibles: {allSus.length}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Test test test
          </p>
        </div>
        
        {/* SU Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allSus
            .filter(su => selectedSus.length === 0 || selectedSus.includes(su.su))
            .map(su => (
              <div 
                key={su.id}
                className="p-4 rounded-lg border-2 text-white transition-transform hover:scale-105"
                style={{ 
                  backgroundColor: su.color,
                  borderColor: su.color
                }}
              >
                <div className="flex items-center mb-2">
                  <div 
                    dangerouslySetInnerHTML={{ __html: su.icon }}
                    className="w-6 h-6 mr-2 invert"
                  />
                  <h4 className="font-semibold">{su.name}</h4>
                </div>
                <p className="text-sm opacity-90">
                  SU n°{su.su} • {su.popPercentage.toFixed(1)}%
                </p>
                <p className="text-sm opacity-90">
                  ~{su.realPopulation} habitant·es
                </p>
              </div>
            ))}
        </div>
        
        {selectedSus.length === 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-blue-700 text-sm">
              💡 Vue quartier active - toutes les SUs sont affichées. Sélectionnez une SU spécifique dans le menu de gauche pour voir ses données individuelles.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TestBoard