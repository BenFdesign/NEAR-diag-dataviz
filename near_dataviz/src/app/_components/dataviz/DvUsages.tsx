'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { fetchSuUsagesExtendedData } from '~/lib/datapacks/DpUsages'

// Interface locale pour les données d'usage
interface UsageData {
  value: string
  label: string
  emoji: string
  count: number
  percentage: number
}

// Interface locale pour une question d'usage avec ses données
interface SuUsageQuestion {
  questionKey: string
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  data: UsageData[]
  totalResponses: number
  fetchFunction: string
  isQuartier: boolean
  suId?: number
}
import { getPalette, getSuColors } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

interface DvUsagesProps {
  selectedSus?: number[]
}

const DvUsages: React.FC<DvUsagesProps> = ({ selectedSus }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const svgContainer = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<SuUsageQuestion[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [mainColor, setMainColor] = useState<string>('#002878')
  const [lightColor3, setLightColor3] = useState<string>('#99AAFF')
  const [lightColor1, setLightColor1] = useState<string>('#E6EAFF')
  const [lightColor4, setLightColor4] = useState<string>('#F0F3FF')
  const [darkColor1, setDarkColor1] = useState<string>('#001A4D')
  const [comp2, setComp2] = useState<string>('#FFD700')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // State to track width and height of SVG Container
  const [width, setWidth] = useState<number>()
  const [height, setHeight] = useState<number>()

  // This function calculates width and height of the container
  const getSvgContainerSize = () => {
    if (svgContainer.current) {
      const newWidth = svgContainer.current.clientWidth
      const newHeight = svgContainer.current.clientHeight
      setWidth(newWidth)
      setHeight(newHeight)
    }
  }

  useEffect(() => {
    // detect 'width' and 'height' on render
    getSvgContainerSize()
    // listen for resize changes, and detect dimensions again when they change
    window.addEventListener("resize", getSvgContainerSize)
    // cleanup event listener
    return () => window.removeEventListener("resize", getSvgContainerSize)
  }, [])

  // Additional effect to ensure dimensions are set after data loads
  useEffect(() => {
    if (data.length > 0 && svgContainer.current && (!width || !height)) {
      // Small delay to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        getSvgContainerSize()
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [data, width, height])

  // Load data + colors effect
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Déterminer l'ID de SU pour les couleurs
        let globalSuId: number | undefined = undefined
        
        if (selectedSus && selectedSus.length === 1 && selectedSus[0] !== undefined) {
          // Convertir l'ID local vers l'ID global pour DpColor
          const globalIds = await mapLocalToGlobalIds([selectedSus[0]])
          globalSuId = globalIds[0]
          console.log(`🎨 Mapping couleur: SU locale ${selectedSus[0]} → SU globale ${globalSuId}`)
        }
        
        // Charger les données et les couleurs en parallèle
        const result = fetchSuUsagesExtendedData(selectedSus)
        const [palette, suColors] = await Promise.all([
          getPalette('gradient', globalSuId),
          getSuColors(globalSuId)
        ])
        
        console.log(`🎨 Palette chargée pour SU ${globalSuId}:`, palette.slice(0, 3), '...')
        console.log(`🎨 Couleur principale:`, suColors.colorMain)
        console.log(`📊 Données d'usage chargées:`, result.length, 'questions')
        
        setData(result)
        setColors(palette)
        setMainColor(suColors.colorMain)
        setLightColor3(suColors.colorLight3)
        setLightColor1(suColors.colorLight1)
        setLightColor4(suColors.colorLight4)
        setDarkColor1(suColors.colorDark1)
        setComp2(suColors.colorComp2)
        
      } catch (err) {
        console.error('Failed to load usage data:', err)
        setError('Erreur lors du chargement des données d\'usage')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedSus])

  // D3 Violin Chart
  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current || colors.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove() // Clear previous content

    // Use fallback dimensions if responsive dimensions not yet available
    const fallbackWidth = 300
    const fallbackHeight = 250
    
    // Dimensions following ResponsiveD3 pattern
    const dimensions = {
      width: width ?? fallbackWidth,
      height: height ?? fallbackHeight,
      margins: 20,
      containerWidth: 0,
      containerHeight: 0
    }

    dimensions.containerWidth = dimensions.width - dimensions.margins * 2
    dimensions.containerHeight = dimensions.height - dimensions.margins * 2
    
    // Set SVG dimensions with background
    svg
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)

    // Background de couleur avec même border-radius que le conteneur (.dv-container)
    /*
    svg.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('fill', lightColor4)
      .attr('rx', 12) // border-radius en SVG - même valeur que .dv-container
      .attr('ry', 12)
      .attr('opacity', 0.2)
    */

    const container = svg.append('g')
      .attr('class', 'container')
      .attr('transform', `translate(${dimensions.margins}, ${dimensions.margins})`)

    // Add main title (same style as DvGenre)
    svg.append('text')
      .attr('x', dimensions.margins)
      .attr('y', 20)
      .attr('class', 'dv-title')
      .style('fill', mainColor)
      .text('🔮 Habitudes de consommation')

    // Calculate layout for each usage category
    const titleHeight = 30 // Space for main title
    const gapBetweenSections = 15 // Gap entre chaque section sous-titre + violin
    const availableHeight = dimensions.containerHeight - titleHeight - (gapBetweenSections * (data.length - 1))
    const categoryHeight = availableHeight / data.length
    const subtitleHeight = 25 // Espace pour le sous-titre
    const emojiHeight = 15 // Hauteur approximative des emojis (font-size: 12px + marge)
    const percentageHeight = 12 // Hauteur approximative des pourcentages (font-size: 10px + marge)
    // const labelHeight = 10 // Les labels sont maintenant sur la ligne horizon
    const spacingBetweenSubtitleAndViolin = 10 + emojiHeight // Espace supplémentaire incluant la taille des emojis
    const spacingAfterViolin = percentageHeight + 10 // Espace après les violins pour % seulement (labels sur horizon)
    const violinAreaHeight = categoryHeight - subtitleHeight - spacingBetweenSubtitleAndViolin - spacingAfterViolin
    const violinWidth = dimensions.containerWidth * 0.8 // 80% of width for violin
    const violinStartX = (dimensions.containerWidth - violinWidth) / 2

    // Calculate global max percentage for comparability across all questions
    const globalMaxPercentage = d3.max(data.flatMap(question => 
      question.data.map((d: UsageData) => d.percentage)
    )) ?? 100

    // Create violin chart for each usage category
    data.forEach((question, questionIndex) => {
      const categoryY = titleHeight + questionIndex * (categoryHeight + gapBetweenSections)
      const categoryGroup = container.append('g')
        .attr('class', 'usage-category')
        .attr('transform', `translate(0, ${categoryY})`)

      // Add subtitle for this usage category
      categoryGroup.append('text')
        .attr('x', dimensions.containerWidth / 2)
        .attr('y', subtitleHeight / 2)
        .attr('class', 'category-subtitle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', mainColor)
        .style('text-anchor', 'middle')
        .style('dominant-baseline', 'middle')
        .text(`${question.questionLabels.emoji} ${question.questionLabels.title}`)

      // Ensure we have exactly 3 data points, take first 3 if more
      const violinData = question.data.slice(0, 3)
      if (violinData.length !== 3) {
        console.warn(`Usage category ${question.questionKey} has ${violinData.length} data points, expected 3`)
        return
      }

      const violinGroup = categoryGroup.append('g')
        .attr('class', 'violin-group')
        .attr('transform', `translate(0, ${subtitleHeight + spacingBetweenSubtitleAndViolin})`)

      // Calculate violin segments positions
      const segmentSpacing = violinWidth / 2 // Space between left-center and center-right
      const leftX = violinStartX
      const centerX = violinStartX + segmentSpacing
      const rightX = violinStartX + violinWidth

      // Calculate violin height scale using global max for comparability
      const heightScale = d3.scaleLinear()
        .domain([0, globalMaxPercentage])
        .range([0, violinAreaHeight / 2]) // Half height for each side of horizon

      const horizonY = violinAreaHeight / 2 // Horizon line (invisible)

      // Calculate segment heights
      const leftHeight = heightScale(violinData[0]?.percentage ?? 0)
      const centerHeight = heightScale(violinData[1]?.percentage ?? 0) 
      const rightHeight = heightScale(violinData[2]?.percentage ?? 0)

      // Create violin shape using path with Bézier curves
      const violinPath = d3.path()
      
      // Start at top-left
      violinPath.moveTo(leftX, horizonY - leftHeight)
      
      // Curve to top-center
      violinPath.bezierCurveTo(
        leftX + segmentSpacing * 0.3, horizonY - leftHeight,
        centerX - segmentSpacing * 0.3, horizonY - centerHeight,
        centerX, horizonY - centerHeight
      )
      
      // Curve to top-right
      violinPath.bezierCurveTo(
        centerX + segmentSpacing * 0.3, horizonY - centerHeight,
        rightX - segmentSpacing * 0.3, horizonY - rightHeight,
        rightX, horizonY - rightHeight
      )
      
      // Line down to bottom-right
      violinPath.lineTo(rightX, horizonY + rightHeight)
      
      // Curve to bottom-center
      violinPath.bezierCurveTo(
        rightX - segmentSpacing * 0.3, horizonY + rightHeight,
        centerX + segmentSpacing * 0.3, horizonY + centerHeight,
        centerX, horizonY + centerHeight
      )
      
      // Curve to bottom-left
      violinPath.bezierCurveTo(
        centerX - segmentSpacing * 0.3, horizonY + centerHeight,
        leftX + segmentSpacing * 0.3, horizonY + leftHeight,
        leftX, horizonY + leftHeight
      )
      
      // Close path
      violinPath.closePath()

      // Add the violin shape (sans tooltip)
      violinGroup.append('path')
        .attr('d', violinPath.toString())
        .attr('fill', mainColor)
        .attr('opacity', 0.7)
        .attr('stroke', darkColor1)
        .attr('stroke-width', 1)

      // Add vertical segments (visual guides)
      const segments = [
        { x: leftX, height: leftHeight, data: violinData[0] },
        { x: centerX, height: centerHeight, data: violinData[1] },
        { x: rightX, height: rightHeight, data: violinData[2] }
      ].filter(segment => segment.data) // Filter out undefined data

      segments.forEach((segment, _segmentIndex) => {
        const segmentGroup = violinGroup.append('g')
          .attr('class', 'segment-group')

        // Add vertical line segment (masqué - on ne voit que l'aire)
        segmentGroup.append('line')
          .attr('x1', segment.x)
          .attr('y1', horizonY - segment.height)
          .attr('x2', segment.x)
          .attr('y2', horizonY + segment.height)
          .attr('stroke', darkColor1)
          .attr('stroke-width', 2)
          .attr('opacity', 0) // Masqué - seule l'aire est visible

        // Add emoji above segment (avec plus d'espace depuis le sous-titre)
        if (segment.data) {
          segmentGroup.append('text')
            .attr('x', segment.x)
            .attr('y', horizonY - segment.height - 15) // Augmenté de 10 à 15 pour plus d'espace
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(segment.data.emoji)

          // Add percentage below segment
          segmentGroup.append('text')
            .attr('x', segment.x)
            .attr('y', horizonY + segment.height + 18)
            .attr('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .style('fill', darkColor1)
            .text(`${segment.data.percentage.toFixed(0)}%`)

          // Add label on horizon line 
          segmentGroup.append('text')
            .attr('x', segment.x)
            .attr('y', horizonY) // Sur la ligne horizontale
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '11px') // Plus gros que 8px
            .style('font-weight', 'bold')
            .style('fill', 'white')
            .style('text-shadow', '2px 2px 2px rgba(0,0,0,0.8)') // Contour pour lisibilité
            .text(segment.data.label.length > 10 ? segment.data.label.substring(0, 10) + '...' : segment.data.label)

          // Add invisible tooltip area around each segment
          const tooltipArea = segmentGroup.append('rect')
            .attr('x', segment.x - 25) // Largeur de 50px centrée sur le segment
            .attr('y', Math.min(horizonY - segment.height - 20, 0)) // Du haut du segment (avec emoji espacé)
            .attr('width', 50)
            .attr('height', Math.abs(horizonY - segment.height - 20) + Math.abs(horizonY + segment.height + 25)) // Hauteur totale incluant emoji et % (labels sur horizon)
            .attr('fill', 'transparent')
            .style('cursor', 'pointer')

          // Add tooltip interactions to each segment area
          tooltipArea
            .on('mouseover', function(event: MouseEvent) {
              // Show tooltip pour ce segment spécifique
              const tooltip = d3.select('body').append('div')
                .attr('class', 'segment-tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.8)')
                .style('color', 'white')
                .style('padding', '8px')
                .style('border-radius', '4px')
                .style('font-size', '12px')
                .style('pointer-events', 'none')
                .style('z-index', '9999')
                .style('opacity', 0)

              tooltip.transition()
                .duration(200)
                .style('opacity', 1)
              
              tooltip.html(`
                <div><strong>${question.questionLabels.title}</strong></div>
                <div>${segment.data?.emoji ?? ''} ${segment.data?.label ?? ''}</div>
                <div>${segment.data?.percentage.toFixed(1) ?? '0'}% (${segment.data?.count ?? 0} réponses)</div>
              `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')

              // Highlight ce segment
              d3.select(segmentGroup.node())
                .select('line')
                .attr('opacity', 0.3) // Légèrement visible au hover
            })
            .on('mouseout', function() {
              // Hide tooltip
              d3.selectAll('.segment-tooltip')
                .transition()
                .duration(200)
                .style('opacity', 0)
                .remove()
              
              // Reset segment style
              d3.select(segmentGroup.node())
                .select('line')
                .attr('opacity', 0) // Retour invisible
            })
        }
      })

      // Violin shape n'a plus de tooltip - les tooltips sont maintenant sur chaque segment
    })

  }, [data, colors, mainColor, lightColor3, lightColor1, lightColor4, darkColor1, comp2, width, height])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement des données d&apos;usage...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Aucune donnée d&apos;usage disponible
      </div>
    )
  }

  return (
    <div ref={svgContainer} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  )
}

export default DvUsages