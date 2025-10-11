import { useRef, useEffect, useState } from 'react';
import { select } from 'd3';
import { fetchHowManyPeopleCanIHelpData } from '../datapacks/DpHowManyPeopleCanIHelp';

interface DvHowManyPeopleCanIHelpProps {
  selectedSus?: number[];
}

export default function DvHowManyPeopleCanIHelp({ selectedSus }: DvHowManyPeopleCanIHelpProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 📊 Récupération des données via le datapack modernisé
  const result = fetchHowManyPeopleCanIHelpData(selectedSus);
  const { data, questionLabels, color } = result;
  
  // Les couleurs sont maintenant gérées par le datapack via getCategoryColors()

  // 📐 Mesure des dimensions selon les nouvelles règles (CSS Grid responsivity)
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // 🎨 Rendu du graphique selon les nouvelles règles
  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const svgElement = svgRef.current;
    const svgRect = svgElement.getBoundingClientRect();
    const svgWidth = svgRect.width;
    const svgHeight = svgRect.height;

    if (svgWidth === 0 || svgHeight === 0) return;

    // Marges fixes selon les nouvelles règles
    const padding = Math.max(1, Math.min(svgWidth, svgHeight) * 0.02);
    const margin = { 
      top: padding, 
      right: padding, 
      bottom: Math.max(50, svgHeight * 0.15), 
      left: padding 
    };
    const chartWidth = svgWidth - margin.left - margin.right;
    const chartHeight = svgHeight - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Filtrer les données visibles (pourcentage > 0)
    const visibleData = data.filter(d => d.percentage > 0);
    
    if (visibleData.length === 0) return;

    // Calcul des dimensions des barres
    const maxPercentage = Math.max(...visibleData.map(d => d.percentage), 10);
    const barSpacing = 4; // Espacement fixe selon nouvelles règles
    const barWidth = (chartWidth - (visibleData.length - 1) * barSpacing) / visibleData.length;
    
    // Ligne de base
    g.append('line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', chartHeight)
      .attr('y2', chartHeight)
      .attr('stroke', '#333')
      .attr('stroke-width', 2);

    // Barres avec les couleurs du datapack
    visibleData.forEach((d, i) => {
      const x = i * (barWidth + barSpacing);
      const barHeight = (d.percentage / maxPercentage) * (chartHeight - 10);
      const y = chartHeight - barHeight;

      // Barre avec couleur du datapack
      g.append('rect')
        .attr('x', x)
        .attr('y', y)
        .attr('width', barWidth)
        .attr('height', barHeight)
        .attr('fill', d.color);

      // Label de pourcentage si la barre est assez grande
      const minHeightForLabel = 25;
      if (barHeight > minHeightForLabel && d.percentage >= 5) {
        g.append('text')
          .attr('class', 'p2-labels')
          .attr('x', x + barWidth / 2)
          .attr('y', y + barHeight / 2)
          .attr('dy', '0.35em')
          .style('fill', 'white')
          .style('font-weight', 'bold')
          .text(`${d.percentage.toFixed(1)}%`);
      }
    });

    // Labels sous les barres
    const labelMargin = 8; // Fixe selon nouvelles règles
    const lineHeight = 12; // Fixe selon nouvelles règles
    
    visibleData.forEach((d, i) => {
      const x = i * (barWidth + barSpacing) + barWidth / 2;
      
      // Diviser les longs labels en plusieurs lignes
      const words = d.label.split(/\s+/);
      const maxWordsPerLine = barWidth > 80 ? 3 : 2;
      const lines = [];
      
      for (let j = 0; j < words.length; j += maxWordsPerLine) {
        lines.push(words.slice(j, j + maxWordsPerLine).join(' '));
      }
      
      lines.forEach((line, lineIndex) => {
        g.append('text')
          .attr('class', 'p2-labels')
          .attr('x', x)
          .attr('y', chartHeight + labelMargin + (lineIndex * lineHeight) + 10)
          .text(line);
      });
    });

  }, [data, dimensions]);

  if (!data || data.length === 0) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h2 className="H2-Dv">{questionLabels.title}</h2>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d' }}>
          Aucune donnée disponible
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 className="H2-Dv">{questionLabels.emoji} {questionLabels.title}</h2>
      <div style={{ flex: 1, padding: '2%', boxSizing: 'border-box' }}>
        <svg 
          ref={svgRef} 
          width="100%" 
          height="100%" 
          style={{ display: 'block' }}
        />
      </div>
    </div>
  );
}
