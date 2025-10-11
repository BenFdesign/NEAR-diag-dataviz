import { fetchSuUsagesData, SU_USAGES_QUESTIONS } from '../datapacks/DpSuUsages';
import suBankData from '../data/Su Bank.json';

interface UsageData {
  value: string;
  label: string;
  emoji: string;
  count: number;
  percentage: number;
}

interface DvSuUsagesViolinProps {
  suId?: number;
  selectedSus?: number[];
}

export default function DvSuUsagesViolin({ suId, selectedSus }: DvSuUsagesViolinProps) {
  const data = fetchSuUsagesData(selectedSus);
  const palette = suBankData.find(su => su.Id === suId)?.colorMain || '#2563eb';

  return (
    <div className="dv-su-usages-violin">
      <h2 className="dv-main-title">Habitudes de consommation</h2>
      <div className="violin-grid">
        {SU_USAGES_QUESTIONS.map((question) => {
          const questionData: UsageData[] = data[question.key];
          const maxPercentage = Math.max(...questionData.map(d => d.percentage));
          
          return (
            <div key={question.id} className="violin-question">
              <h4 className="violin-question-title">{question.title}</h4>
              <div className="violin-container-small">
                <svg width="1000" height="60" viewBox="0 0 1000 60">
                  {questionData.map((item, index) => {
                    const x = index * 55 + 30;
                    const height = (item.percentage / maxPercentage);
                    const y = 0 - height;
                    
                    return (
                      <g key={item.value}>
                        {/* Violin shape - simplified as rounded rectangle */}
                        <rect
                          x={x - 12}
                          y={y}
                          width={24}
                          height={height}
                          rx={12}
                          fill={palette}
                          opacity={0.7}
                        />
                        
                        {/* Emoji */}
                        <text
                          x={x}
                          y={y - 8}
                          textAnchor="middle"
                          fontSize="12"
                        >
                          {item.emoji}
                        </text>
                        
                        {/* Label */}
                        <text
                          x={x}
                          y={72}
                          textAnchor="middle"
                          fontSize="8"
                          fill="#666"
                        >
                          {item.label}
                        </text>
                        
                        {/* Percentage */}
                        {height > 15 && (
                          <text
                            x={x}
                            y={y + height/2 + 2}
                            textAnchor="middle"
                            fontSize="9"
                            fill="white"
                            fontWeight="bold"
                          >
                            {item.percentage}%
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}