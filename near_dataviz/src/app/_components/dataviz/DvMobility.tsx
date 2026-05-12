"use client"

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getDpMobilityDatapack, type MobilityPayload } from '~/lib/datapacks/DpMobility'
import { getSuColors, type SuColors } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

interface Props {
  selectedSus?: number[]
}

const DvMobility: React.FC<Props> = ({ selectedSus }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [mobilityData, setMobilityData] = useState<MobilityPayload | null>(null)
  const [suColors, setSuColors] = useState<SuColors | null>(null)

  // Responsive container size
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const { clientWidth, clientHeight } = containerRef.current
      setDimensions({ width: clientWidth, height: clientHeight })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Fetch DpMobility data
  useEffect(() => {
    void getDpMobilityDatapack({ selectedSus: selectedSus ?? [] }).then((res) => {
      setMobilityData(res.data)
    })
  }, [selectedSus])

  // Fetch SuColors
  useEffect(() => {
    // Même logique que DpMobility : length=0, length>1, ou que des 0 → vue Quartier
    const isQuartier = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1 || selectedSus.every((id) => id === 0)
    if (isQuartier) {
      void getSuColors(0).then(setSuColors)
    } else {
      void mapLocalToGlobalIds(selectedSus).then(async (globalIds) => {
        setSuColors(await getSuColors(globalIds[0]))
      })
    }
  }, [selectedSus])

  // D3 drawing
  useEffect(() => {
    const { width, height } = dimensions
    if (!svgRef.current || width === 0 || height === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const colorMain = suColors?.colorMain ?? '#1565c0'
    const colorLight = suColors?.colorLight4 ?? '#90caf9'

    const cx = width / 2
    const cy = height / 2
    const unit = Math.min(width, height) // symetrie responsive
    const r = unit / 14
    const posAx = 0.27 * unit
    const posBx = 0.40 * unit
    const posABy = 0.075 * unit

    //y = up/down
    //x = L/R

    // Cercle de légende : Rayon de 20 mins à pieds
    const ringRadius = posAx + r - (r * 0.15)
    const ringG = svg
      .append('g')
      .attr('id', '20-min-ring')

    ringG
      .append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', ringRadius)
      .attr('fill', 'none')
      .attr('stroke', colorMain)
      //.attr('background-opacity', 0)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '6 4')

    // Texte sur la partie basse du ring
    const arcR = ringRadius - 12 //offset du texte "20 mins"
    const arcId = '20-min-ring-arc-path'
    ringG
      .append('defs')
      .append('path')
      .attr('id', arcId)
      .attr('d', `M ${cx - arcR} ${cy} A ${arcR} ${arcR} 0 1 1 ${cx + arcR} ${cy}`)

    ringG
      .append('text')
      .attr('font-family', 'Outfit')
      .attr('font-size', 12)
      //.attr('transform', 'scale(-1, 1)')
      .attr('fill', colorMain)
      .attr('letter-spacing', 1)
      .append('textPath')
      .attr('href', `#${arcId}`)
      .attr('startOffset', '73%')
      .attr('text-anchor', 'middle')
      .text('~20 mins à pieds')

    //Placement des cercles :
    const circles: { id: string; x: number; y: number }[] = [
      { id: 'circle-center',   x: cx,            y: cy },                  
      { id: 'circle-up-a',     x: cx - posABy,   y: cy - posAx },    
      { id: 'circle-up-b',     x: cx + posABy,   y: cy - posBx },    
      { id: 'circle-down-a',   x: cx + posABy,   y: cy + posAx },    
      { id: 'circle-down-b',   x: cx - posABy,   y: cy + posBx },    
      { id: 'circle-left-a',   x: cx - posAx,    y: cy + posABy },    
      { id: 'circle-left-b',   x: cx - posBx,    y: cy - posABy },    
      { id: 'circle-right-a',  x: cx + posAx,    y: cy - posABy },    
      { id: 'circle-right-b',  x: cx + posBx,    y: cy + posABy },    
    ]

    /*
    const circleCenter = circles[0]!
    svg
      .append('g')
      .attr('id', circleCenter.id)
      .append('text')
      .attr('font-family', 'Outfit')
      .attr('font-size', 12)
      .text('Quartier')
      .attr('z-index', 2)
      .attr('color', '#1565c0')
    */

    // Lignes courbes en paquets de 4 — dessinées avant les cercles
    const n = 15                   // espacement centre à centre
    const spacing = n
    const lineCount = 4
    const bowRatio = 0.20 //Math.random() * 0.30         // courbure 

    const modes: { id: string }[] = [
      { id: 'foot'  },
      { id: 'bike'  },
      { id: 'trans' },
      { id: 'car'   },
    ]

    // Icône par mode (partagée entre toutes les lignes du même mode)
    const modeIcon: Record<string, string> = {
      foot:  '🚶',
      bike:  '🚲',
      trans: '🚌',
      car:   '🚗',
    }

    // Mapping circle → zone key (up=A/nord, right=B/est, down=C/sud, left=D/ouest)
    const circleToZone: Record<string, string> = {
      'circle-center':  'ZONE_PORTE_ORLEANS',
      'circle-up-a':    'ZONE_A_A',
      'circle-up-b':    'ZONE_A_B',
      'circle-right-a': 'ZONE_B_A',
      'circle-right-b': 'ZONE_B_B',
      'circle-down-a':  'ZONE_C_A',
      'circle-down-b':  'ZONE_C_B',
      'circle-left-a':  'ZONE_D_A',
      'circle-left-b':  'ZONE_D_B',
    }
    const modeToMtKey: Record<string, 'FOOT' | 'BIKE' | 'TRANS' | 'CAR'> = {
      foot: 'FOOT', bike: 'BIKE', trans: 'TRANS', car: 'CAR',
    }
    const LINE_STROKE_MIN = 0.5
    const LINE_STROKE_MAX = 15
    const getMtPct = (zoneKey: string | undefined, mtKey: 'FOOT' | 'BIKE' | 'TRANS' | 'CAR'): number | null => {
      if (!zoneKey) return null
      const cell = mobilityData?.zoneDistribution[zoneKey]
      return cell ? cell.mobilityTypeBreakdown.pct[mtKey] : null
    }
    const strokeFromPct = (pct: number | null): number =>
      pct != null ? LINE_STROKE_MIN + (pct / 100) * (LINE_STROKE_MAX - LINE_STROKE_MIN) : 2
    const fmtPct = (pct: number | null) => pct != null ? `${Math.round(pct)}%` : '–'

    // strokeWidth et lineLabel : calculés depuis mobilityTypeBreakdown.pct de la zone cible
    const lineStrokeWidth: Record<string, number> = {}
    const lineLabel: Record<string, string> = {}
    // Satellite rings autour du centre — ZONE_PORTE_ORLEANS
    for (const mode of modes) {
      const mtKey = modeToMtKey[mode.id]!
      const pct = getMtPct('ZONE_PORTE_ORLEANS', mtKey)
      lineStrokeWidth[`circle-center-${mode.id}`] = strokeFromPct(pct)
      lineLabel[`circle-center-${mode.id}`] = fmtPct(pct)
    }
    // Lignes vers les cercles satellites — zone de la cible
    for (const { id: targetId } of circles.slice(1)) {
      const zoneKey = circleToZone[targetId]
      for (const mode of modes) {
        const mtKey = modeToMtKey[mode.id]!
        const pct = getMtPct(zoneKey, mtKey)
        lineStrokeWidth[`${mode.id}-to-${targetId}`] = strokeFromPct(pct)
        lineLabel[`${mode.id}-to-${targetId}`] = fmtPct(pct)
      }
    }

    // Targets whose path goes right-to-left/bottom-to-top → reverse def path for legible text
    const reversedTextTargets = new Set([
      'circle-down-b',
      'circle-left-a',
      'circle-left-b',
      'circle-up-a',
    ])

    // startOffset du texte par paquet (cible)
    const targetStartOffset: Record<string, string> = {
      'circle-up-a':    '35%',
      'circle-up-b':    '70%',
      'circle-down-a':  '65%',
      'circle-down-b':  '30%',
      'circle-left-a':  '35%',
      'circle-left-b':  '35%',
      'circle-right-a': '65%',
      'circle-right-b': '70%',
    }

    const center = circles[0]!
    const linesG = svg.append('g').attr('id', 'connection-lines')
    const lineDefs = linesG.append('defs')

    circles.slice(1).forEach(({ id: targetId, x: tx, y: ty }) => {
      const dx = tx - center.x
      const dy = ty - center.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const nx = -dy / dist
      const ny =  dx / dist
      const bow = dist * bowRatio

      for (let i = 0; i < lineCount; i++) {
        const mode = modes[i]!
        const offset = (i - (lineCount - 1) / 2) * spacing
        const sx  = center.x + offset * nx
        const sy  = center.y + offset * ny
        const ex  = tx       + offset * nx
        const ey  = ty       + offset * ny
        const cpx = (sx + ex) / 2 + bow * nx
        const cpy = (sy + ey) / 2 + bow * ny

        const lineId = `${mode.id}-to-${targetId}`
        const pathDefId = `path-def-${lineId}`

        // Path dans defs pour le textPath — inversé si le trajet va R→L / bas→haut
        const reversed = reversedTextTargets.has(targetId)
        lineDefs.append('path')
          .attr('id', pathDefId)
          .attr('d', reversed
            ? `M ${ex},${ey} Q ${cpx},${cpy} ${sx},${sy}`
            : `M ${sx},${sy} Q ${cpx},${cpy} ${ex},${ey}`)

        linesG.append('path')
          .attr('id', lineId)
          .attr('d', `M ${sx},${sy} Q ${cpx},${cpy} ${ex},${ey}`)
          .attr('fill', 'none')
          .attr('stroke', colorLight)
          .attr('stroke-width', lineStrokeWidth[lineId] ?? 2)
          .attr('opacity', 0.7)

        // Icône + texte qui suivent la courbe --> % de mode / desti
        linesG.append('text')
          .attr('font-size', 12)
          .attr('font-family', 'Outfit')
          .attr('fill', colorMain)
          .attr('dy', '4')
          .append('textPath')
          .attr('href', `#${pathDefId}`)
          .attr('startOffset', targetStartOffset[targetId] ?? '50%')
          .attr('text-anchor', 'middle')
          .text(`${modeIcon[mode.id] ?? ''} ${lineLabel[lineId] ?? ''}`)
      }
    })

    // Icônes usage en triangle à l'intérieur de chaque cercle
    const USAGE_ICON_SIZE_MIN = 10
    const USAGE_ICON_SIZE_MAX = 25
    const usageTriangleR = r * 0.45
    const usages: { id: string; icon: string; angle: number }[] = [
      { id: 'hobby', icon: '🪁', angle: -Math.PI / 2 },
      { id: 'work',  icon: '💼', angle: -Math.PI / 2 + (2 * Math.PI) / 3 },
      { id: 'food',  icon: '🛒', angle: -Math.PI / 2 + (4 * Math.PI) / 3 },
    ]
    const usageToPctKey: Record<string, 'work' | 'hobby' | 'buyFood'> = {
      work:  'work',
      hobby: 'hobby',
      food:  'buyFood',
    }

    // Taille par icône : calculée depuis zoneDistribution[zone].pct.{work|hobby|buyFood}
    const usageIconSize: Record<string, number> = {}
    for (const { id: circleId } of circles) {
      const zoneKey = circleToZone[circleId]
      const cell = zoneKey ? mobilityData?.zoneDistribution[zoneKey] : undefined
      for (const usage of usages) {
        const pctKey = usageToPctKey[usage.id]
        const pct = (cell && pctKey) ? cell.pct[pctKey] : null
        usageIconSize[`${circleId}-${usage.id}`] = pct != null
          ? USAGE_ICON_SIZE_MIN + (pct / 100) * (USAGE_ICON_SIZE_MAX - USAGE_ICON_SIZE_MIN)
          : 14
      }
    }

    // Font-weight et stroke-width des cercles satellites : pilotés par pctOfTotal de leur zone
    const FONT_WEIGHT_MIN = 200
    const FONT_WEIGHT_MAX = 2000
    const CIRCLE_STROKE_MIN = 1
    const CIRCLE_STROKE_MAX = 30
    const CIRCLE_RADIUS_FACTOR_MIN = 0.85  // r × 0.85 au minimum
    const CIRCLE_RADIUS_FACTOR_MAX = 1.15  // r × 1.15 au maximum
    const fontWeightForCircle: Record<string, number> = {}
    const strokeForCircle: Record<string, number> = {}
    const radiusForCircle: Record<string, number> = {}
    for (const { id } of circles) {
      const zoneKey = circleToZone[id]
      const pct = zoneKey ? (mobilityData?.zoneDistribution[zoneKey]?.pctOfTotal ?? null) : null
      fontWeightForCircle[id] = pct != null
        ? Math.round(FONT_WEIGHT_MIN + (pct / 100) * (FONT_WEIGHT_MAX - FONT_WEIGHT_MIN))
        : 400
      strokeForCircle[id] = pct != null
        ? CIRCLE_STROKE_MIN + (pct / 100) * (CIRCLE_STROKE_MAX - CIRCLE_STROKE_MIN)
        : 2
      radiusForCircle[id] = pct != null
        ? r * (CIRCLE_RADIUS_FACTOR_MIN + (pct / 100) * (CIRCLE_RADIUS_FACTOR_MAX - CIRCLE_RADIUS_FACTOR_MIN))
        : r
    }

    // Fond blanc couvrant la zone centrale (sur les lignes, sous les cercles)
    svg.append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', r + 4 * spacing)
      .attr('fill', 'white')
      .attr('stroke', 'none')

    circles.forEach(({ id, x, y }) => {
      const g = svg
        .append('g')
        .attr('id', id)

      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', radiusForCircle[id] ?? r)
        .attr('fill', colorLight)
        .attr('stroke', colorMain)
        .attr('stroke-width', strokeForCircle[id] ?? 2)

      if (id === 'circle-center') {
        g.append('text')
          .attr('x', x)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-family', 'Outfit')
          .attr('font-size', 12)
          .attr('fill', colorMain)
          .attr('pointer-events', 'none')
          .text('Quartier')
      }

      // 3 icônes usage en triangle
      usages.forEach((usage) => {
        const ux = x + usageTriangleR * Math.cos(usage.angle)
        const uy = y + usageTriangleR * Math.sin(usage.angle)
        const sz = Math.min(
          USAGE_ICON_SIZE_MAX,
          Math.max(USAGE_ICON_SIZE_MIN,
            usageIconSize[`${id}-${usage.id}`] ?? usageIconSize[usage.id] ?? 14
          )
        )
        g.append('text')
          .attr('id', `usage-${id}-${usage.id}`)
          .attr('x', ux)
          .attr('y', uy)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', sz)
          .attr('pointer-events', 'none')
          .text(usage.icon)
      })
    })

    // Labels satellites : texte de légende pour chaque cercle destination
    // Paramétrage indépendant par cercle : texte + offset (dx, dy) depuis le centre du cercle correspondant
    const destLabelText: Record<string, string> = {
      'circle-up-a':    'Vers zone N A',
      'circle-up-b':    'Vers zone N B',
      'circle-down-a':  'Vers zone S A',
      'circle-down-b':  'Vers zone S B',
      'circle-left-a':  'Vers zone L A',
      'circle-left-b':  'Vers zone L B',
      'circle-right-a': 'Vers zone R A',
      'circle-right-b': 'Vers zone R B',
    }

    const destLabelOffset: Record<string, { dx: number; dy: number; anchor: string }> = {
      'circle-up-a':    { dx: -r - 4, dy:  0,      anchor: 'end'    },
      'circle-up-b':    { dx:  r + 4, dy:  0,      anchor: 'start'  },
      'circle-down-a':  { dx:  r + 4, dy:  0,      anchor: 'start'  },
      'circle-down-b':  { dx: -r - 4, dy:  0,      anchor: 'end'    },
      'circle-left-a':  { dx: -r - 4, dy:  0,      anchor: 'end'    },
      'circle-left-b':  { dx: -r - 4, dy:  0,      anchor: 'end'    },
      'circle-right-a': { dx:  r + 4, dy:  0,      anchor: 'start'  },
      'circle-right-b': { dx:  r + 4, dy:  0,      anchor: 'start'  },
    }

    circles.slice(1).forEach(({ id, x, y }) => {
      const cfg = destLabelOffset[id]
      if (!cfg) return
      svg.append('text')
        .attr('id', `dest-${id}`)
        .attr('x', x + cfg.dx)
        .attr('y', y + cfg.dy)
        .attr('text-anchor', cfg.anchor)
        .attr('dominant-baseline', 'central')
        .attr('font-family', 'Outfit')
        .attr('font-size', 12)
        .attr('font-weight', fontWeightForCircle[id] ?? 400)
        .attr('fill', colorMain)
        .attr('pointer-events', 'none')
        .text(destLabelText[id] ?? id)
    })

    // 4 cercles concentriques autour de circle-center (même cx/cy, rayon croissant)
    const satSpacing = spacing
    const satelliteCircles: { id: string; mode: string; index: number }[] = [
      { id: 'circle-center-foot',  mode: 'foot',  index: 1 },
      { id: 'circle-center-bike',  mode: 'bike',  index: 2 },
      { id: 'circle-center-trans', mode: 'trans', index: 3 },
      { id: 'circle-center-car',   mode: 'car',   index: 4 },
    ]

    satelliteCircles.forEach(({ id: satId, mode: satMode, index }) => {
      const satR = r + index * satSpacing

      const satG = svg.append('g').attr('id', satId)

      satG.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', satR)
        .attr('fill', 'none')
        .attr('stroke', colorLight)
        .attr('stroke-width', lineStrokeWidth[satId] ?? 2)

      // Arc du dessus pour le texte (sens antihoraire : 9h → 12h → 3h)
      const satArcId = `arc-def-${satId}`
      const satArcOffset = satR
      satG.append('defs')
        .append('path')
        .attr('id', satArcId)
        .attr('d', `M ${cx - satArcOffset} ${cy} A ${satArcOffset} ${satArcOffset} 0 1 1 ${cx + satArcOffset} ${cy}`)

      // Légende + % dans les cercles concentriques Quartier
      satG.append('text')
        .attr('font-size', 12)
        .attr('font-family', 'Outfit')
        .attr('fill', colorMain)
        //.attr("stroke", "white") // tentative pour highlighter
        //.attr("stroke-width", 0.5)
        //.attr("stroke-linejoin", "round")    
        .attr('dy', '3')
        .append('textPath')
        .attr('href', `#${satArcId}`)
        .attr('startOffset', '76%')
        .attr('text-anchor', 'right')
        .text(`${modeIcon[satMode] ?? ''} ${lineLabel[satId] ?? ''}`)
        .append('tspan')
        .attr('background-color', 'white')
        .attr('padding', '0.1em 0.2em')
    })
  }, [dimensions, mobilityData, suColors])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        width={dimensions.width}
        height={dimensions.height}
      />
    </div>
  )
}

export default DvMobility
