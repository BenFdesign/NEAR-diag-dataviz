'use client'

import * as d3 from 'd3'
import React, { useEffect, useRef, useState } from 'react'
import { getDpMobilityByZoneData, type MobilityResult } from '~/lib/datapacks/DpMobilityByZone'
import { getPalette } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

// Centralized color control
const COLOR_CONFIG = Object.freeze({
  applyAxes: true,
  applyLabels: true,
  applyModeStrokes: true,
  applyNodeStroke: true,
  applyNodeFill: false,
  applyUsagePictoColors: true,
  applyModePictosAndValuesColor: true,
  showModeValueTexts: true
})

// Spline mode de transport Max Value
const MODE_SPLINE_MAX_STROKE = 15

// Pictos usages scale
const USAGE_PICTO_MIN_SCALE = 0.1
const USAGE_PICTO_MAX_SCALE = 2
const USAGE_PICTO_SIGMOID_K = 7
const USAGE_PICTO_SIGMOID_X0 = 0.4

// Legend hover constants
const LEGEND_HOVER_DIM_OPACITY = 0.25
const LEGEND_HOVER_STROKE = '#00000055'
const MODE_LEGEND_HOVER_DIM_OPACITY = 0.25

const MODE_LEGEND_COLORS = Object.freeze({
  car: null,
  transit: null,
  bike: null,
  foot: null
})

interface VizColors {
  Cmain?: {
    base?: string
    light1?: string
    light2?: string
  }
  Ccomplementary?: {
    contrast?: string
  }
}

interface ModeData {
  label: string
  value: number
}

interface UsageData {
  label: string
  value: number
}

interface ZoneData {
  destination: string
  usages: {
    unit: string
    leisure: UsageData
    shopping: UsageData
    work: UsageData
    modal: UsageData
  }
  modes: {
    unit: string
    foot: ModeData
    bike: ModeData
    car: ModeData
    transit: ModeData
  }
}

export interface MobilityData {
  Quartier: ZoneData
  Nord1: ZoneData
  Nord2: ZoneData
  Sud1: ZoneData
  Sud2: ZoneData
  Est1: ZoneData
  Est2: ZoneData
  Ouest1: ZoneData
  Ouest2: ZoneData
}

interface DvMobilityGraphProps {
  selectedSus?: number[]
}

interface Theme {
  modeIconsAndValues: string
  modes: {
    car: string
    transit: string
    bike: string
    foot: string
  }
  usages: {
    shopping: string
    work: string
    modal: string
    leisure: string
  }
  nodes: {
    stroke: string
    fill: string
  }
  labels: {
    fill: string
  }
  axes: {
    stroke: string
  }
}

function makeTheme(vizColors?: VizColors): Theme {
  const Cmain = vizColors?.Cmain ?? {}
  const Ccomplementary = vizColors?.Ccomplementary ?? {}
  const greys = ['#f5f5f5', '#dcdcdc', '#c4c4c4', '#a9a9a9', '#808080', '#5a5a5a']

  return Object.freeze({
    modeIconsAndValues: Cmain.base ?? '#FF7A00',
    modes: {
      car: Ccomplementary.contrast ?? '#07070791',
      transit: Ccomplementary.contrast ?? '#07070791',
      bike: Ccomplementary.contrast ?? '#07070791',
      foot: Ccomplementary.contrast ?? '#07070791'
    },
    usages: {
      shopping: Cmain.light1 ?? '#07070791',
      work: Cmain.light1 ?? '#07070791',
      modal: Cmain.light1 ?? '#07070791',
      leisure: Cmain.light1 ?? '#07070791'
    },
    nodes: {
      stroke: Cmain.light1 ?? '#FF7A00',
      fill: Cmain.light2 ?? '#FFE8D2'
    },
    labels: {
      fill: '#000000ff'
    },
    axes: {
      stroke: greys[1]
    }
  })
}

function scaleForPercent(val: number): number {
  const v = Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : 0
  return d3.scaleLinear().domain([0, 100]).range([0, MODE_SPLINE_MAX_STROKE])(v)
}

function scaleUsageForPercent(val: number): number {
  const v = Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : 0
  const x = v / 100
  const k = USAGE_PICTO_SIGMOID_K
  const x0 = USAGE_PICTO_SIGMOID_X0
  const logistic = (t: number) => 1 / (1 + Math.exp(-k * (t - x0)))
  const g = logistic(x)
  const g0 = logistic(0)
  const g1 = logistic(1)
  const denom = g1 - g0
  const gn = denom !== 0 ? (g - g0) / denom : x
  return USAGE_PICTO_MIN_SCALE + (USAGE_PICTO_MAX_SCALE - USAGE_PICTO_MIN_SCALE) * Math.max(0, Math.min(1, gn))
}

const Tooltip = React.forwardRef<HTMLDivElement>((props, ref) => (
  <div
    ref={ref}
    style={{
      position: 'absolute',
      display: 'none',
      background: 'rgba(0, 0, 0, 0.85)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: 500,
      pointerEvents: 'none',
      zIndex: 1000,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      maxWidth: '220px'
    }}
  >
    <div className="tooltip-value" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }} />
    <div className="tooltip-label" style={{ fontSize: '12px', opacity: 0.9 }} />
  </div>
))
Tooltip.displayName = 'Tooltip'

const DvMobilityGraph: React.FC<DvMobilityGraphProps> = ({ selectedSus }) => {
  const [mobilityData, setMobilityData] = useState<MobilityResult | null>(null)
  const [vizColors, setVizColors] = useState<VizColors | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Load data and colors effect
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Determine SU ID for colors
        let globalSuId: number | undefined = undefined
        if (selectedSus && selectedSus.length === 1 && selectedSus[0] !== undefined) {
          const globalIds = await mapLocalToGlobalIds([selectedSus[0]])
          globalSuId = globalIds[0]
          console.log(`🎨 Color mapping: Local SU ${selectedSus[0]} → Global SU ${globalSuId}`)
        }
        
        // Load data and colors in parallel
        const [result, palette] = await Promise.all([
          getDpMobilityByZoneData({ selectedSus }),
          getPalette('gradient', globalSuId)
        ])
        
        // Convert palette array to VizColors format
        const colors: VizColors = {
          Cmain: {
            base: palette[0] ?? '#002878',
            light1: palette[1] ?? '#0040B0',
            light2: palette[2] ?? '#3B82F6'
          },
          Ccomplementary: {
            contrast: palette[3] ?? '#F59E0B'
          }
        }
        
        setMobilityData(result)
        setVizColors(colors)
        setLoading(false)
        console.log('✅ Mobility data loaded successfully')
      } catch (err) {
        console.error('❌ Error loading mobility data:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
      }
    }
    
    void loadData()
  }, [selectedSus])

  useEffect(() => {
    // Guard clause: wait for data to load
    if (!mobilityData || !vizColors) return
    
    const svgPath = '/customSVG_mobilityMegaGraph.svg'
    const data = mobilityData
    const showModeValueTexts = COLOR_CONFIG.showModeValueTexts
    const root = d3.select(ref.current)
    if (!root.node()) return

    root.selectAll('*').remove()

    const obj = root
      .append('object')
      .attr('type', 'image/svg+xml')
      .attr('data', svgPath)
      .attr('aria-label', 'Mobility mega graph')
      .attr('tabindex', 0)
      .style('width', '100%')
      .style('height', 'auto')
      .style('display', 'block')

    function onLoad() {
      const doc = (obj.node() as HTMLObjectElement)?.contentDocument
      if (!doc) return
      const svg = d3.select(doc).select('svg')
      if (svg.empty()) return

      // Remove native tooltips
      // @ts-expect-error - D3 selection type mismatch with Element
      svg.selectAll('*').each(function (this: Element) {
        const first = this.firstElementChild
        if (first && first.tagName && first.tagName.toLowerCase() === 'title') {
          const txt = (first.textContent || '').trim()
          if (txt) this.setAttribute('data-title', txt)
          try {
            // Check if the node is actually a child before removing
            if (first.parentNode === this) {
              this.removeChild(first)
            }
          } catch (err) {
            // Silently ignore removal errors
            console.debug('Could not remove title element:', err)
          }
        }
      })

      const THEME = makeTheme(vizColors)

      function colorForMode(mode: string): string {
        switch (mode) {
          case 'car':
            return THEME.modes.car
          case 'transit':
            return THEME.modes.transit
          case 'bike':
            return THEME.modes.bike
          case 'foot':
            return THEME.modes.foot
          default:
            return '#888888'
        }
      }

      function colorForUsage(usage: string): string {
        switch (usage) {
          case 'shopping':
            return THEME.usages.shopping
          case 'work':
            return THEME.usages.work
          case 'modal':
            return THEME.usages.modal
          default:
            return '#888888'
        }
      }

      const getVal = (k: string, m: string): number => {
        let src: ZoneData | undefined
        switch (k) {
          case 'Quartier':
            src = data?.Quartier
            break
          case 'Nord1':
            src = data?.Nord1
            break
          case 'Nord2':
            src = data?.Nord2
            break
          case 'Sud1':
            src = data?.Sud1
            break
          case 'Sud2':
            src = data?.Sud2
            break
          case 'Est1':
            src = data?.Est1
            break
          case 'Est2':
            src = data?.Est2
            break
          case 'Ouest1':
            src = data?.Ouest1
            break
          case 'Ouest2':
            src = data?.Ouest2
            break
          default:
            src = undefined
        }
        if (!src || !src.modes) return 0
        let v: number
        switch (m) {
          case 'car':
            v = src.modes.car?.value
            break
          case 'transit':
            v = src.modes.transit?.value
            break
          case 'bike':
            v = src.modes.bike?.value
            break
          case 'foot':
            v = src.modes.foot?.value
            break
          default:
            v = 0
        }
        const num = typeof v === 'number' ? v : Number(v)
        return Number.isFinite(num) ? num : 0
      }

      const getUsageVal = (k: string, usage: string): number => {
        let src: ZoneData | undefined
        switch (k) {
          case 'Quartier':
            src = data?.Quartier
            break
          case 'Nord1':
            src = data?.Nord1
            break
          case 'Nord2':
            src = data?.Nord2
            break
          case 'Sud1':
            src = data?.Sud1
            break
          case 'Sud2':
            src = data?.Sud2
            break
          case 'Est1':
            src = data?.Est1
            break
          case 'Est2':
            src = data?.Est2
            break
          case 'Ouest1':
            src = data?.Ouest1
            break
          case 'Ouest2':
            src = data?.Ouest2
            break
          default:
            src = undefined
        }
        if (!src || !src.usages) return 0
        let v: number
        switch (usage) {
          case 'shopping':
            v = src.usages.shopping?.value
            break
          case 'work':
            v = src.usages.work?.value
            break
          case 'modal':
            v = src.usages.modal?.value
            break
          case 'leisure':
            v = src.usages.leisure?.value
            break
          default:
            v = 0
        }
        const num = typeof v === 'number' ? v : Number(v)
        return Number.isFinite(num) ? num : 0
      }

      function destForKey(k: string): string | null {
        switch (k) {
          case 'Quartier':
            return 'Quartier'
          case 'Nord1':
            return 'NordProche'
          case 'Nord2':
            return 'NordLoin'
          case 'Sud1':
            return 'SudProche'
          case 'Sud2':
            return 'SudLoin'
          case 'Est1':
            return 'EstProche'
          case 'Est2':
            return 'EstLoin'
          case 'Ouest1':
            return 'OuestProche'
          case 'Ouest2':
            return 'OuestLoin'
          default:
            return null
        }
      }

      const usageTitlePrefix = (usage: string) =>
        usage === 'shopping'
          ? 'CoursesPictos'
          : usage === 'work'
            ? 'TravailPictos'
            : usage === 'leisure'
              ? 'SortiesPictos'
              : ''

      const modeValueTitlePrefix = (mode: string) =>
        mode === 'car'
          ? 'VoitureValue'
          : mode === 'transit'
            ? 'MetroValue'
            : mode === 'bike'
              ? 'VeloValue'
              : mode === 'foot'
                ? 'PietonValue'
                : ''

      function selectGroupByExactTitle(title: string) {
        return svg.selectAll('g').filter(function (this: Element) {
          return this.getAttribute && this.getAttribute('data-title') === title
        })
      }

      function selectTextByExactTitle(title: string) {
        return svg.selectAll('text').filter(function (this: Element) {
          return this.getAttribute && this.getAttribute('data-title') === title
        })
      }

      function selectAnyByExactTitle(title: string, scopeSel = svg) {
        return scopeSel.selectAll('*').filter(function (this: Element) {
          return this.getAttribute && this.getAttribute('data-title') === title
        })
      }

      function writeValueIntoTextByTitle(title: string, value: number) {
        const content = `${Math.round(value)}%`
        selectTextByExactTitle(title).each(function (this: Element) {
          const el = this
          // Safely clear all children
          try {
            while (el.firstChild) {
              el.removeChild(el.firstChild)
            }
            const textNode = el.ownerDocument?.createTextNode(content)
            if (textNode) {
              el.appendChild(textNode)
            }
          } catch (err) {
            console.debug('Error updating text content:', err)
          }
        })
      }

      function applyCenteredPictoScale(groupSel: d3.Selection<Element, unknown, null, undefined>, factor: number) {
        groupSel.each(function (this: Element) {
          const g = this as SVGGElement
          ;(g.style as CSSStyleDeclaration).transform = ''
          ;(g.style as CSSStyleDeclaration).transformOrigin = ''
          ;(g.style as CSSStyleDeclaration).transformBox = ''

          let wrapper = g.querySelector(':scope > g.picto-scale-wrapper') as SVGGElement | null
          if (!wrapper) {
            wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g')
            wrapper.setAttribute('class', 'picto-scale-wrapper')
            const children = Array.from(g.childNodes)
            for (const node of children) {
              if (node.nodeType === 1 && (node as Element).tagName) {
                const tag = (node as Element).tagName.toLowerCase()
                if (tag === 'title' || tag === 'defs' || tag === 'desc' || tag === 'metadata') {
                  continue
                }
              }
              wrapper.appendChild(node)
            }
            g.appendChild(wrapper)
          }

          let cx = 0,
            cy = 0
          try {
            const bbox = wrapper.getBBox()
            cx = bbox.x + bbox.width / 2
            cy = bbox.y + bbox.height / 2
          } catch (_) {
            wrapper.removeAttribute('transform')
            return
          }

          const f = Number.isFinite(factor) ? factor : 1
          if (Math.abs(f - 1) < 1e-3) {
            wrapper.removeAttribute('transform')
          } else {
            wrapper.setAttribute('transform', `translate(${cx} ${cy}) scale(${f}) translate(${-cx} ${-cy})`)
          }
        })
      }

      if (COLOR_CONFIG.applyAxes) {
        svg.selectAll('#layer-axes ellipse').style('stroke', THEME.axes.stroke)
      }

      if (COLOR_CONFIG.applyLabels) {
        svg.selectAll('text.dest-label').style('fill', THEME.labels.fill)
      }

      ;['car', 'transit', 'bike', 'foot'].forEach((mode) => {
        const val = getVal('Quartier', mode)
        const widthPx = scaleForPercent(val)
        svg
          .selectAll(`ellipse.mode-spline.mode--${mode}[data-dest="Quartier"]`)
          .style('stroke-width', widthPx)
          .style('stroke', colorForMode(mode))
      })

      ;['Quartier', 'Nord1', 'Nord2', 'Sud1', 'Sud2', 'Est1', 'Est2', 'Ouest1', 'Ouest2'].forEach((k) => {
        const dest = destForKey(k)
        if (!dest) return
        ;['car', 'transit', 'bike', 'foot'].forEach((mode) => {
          const val = getVal(k, mode)
          const widthPx = scaleForPercent(val)
          svg
            .selectAll(`.mode-spline.mode--${mode}[data-dest="${dest}"]`)
            .style('stroke-width', widthPx)
            .style('stroke', colorForMode(mode))
            .style('opacity', val > 0 ? 1 : 0.25)
        })
      })

      if (COLOR_CONFIG.applyNodeStroke) {
        svg.selectAll('.dest-node').style('stroke', THEME.nodes.stroke).style('stroke-width', '2px')
      }
      if (COLOR_CONFIG.applyNodeFill) {
        svg.selectAll('.dest-node').style('fill', THEME.nodes.fill)
      }

      ;['Quartier', 'Nord1', 'Nord2', 'Sud1', 'Sud2', 'Est1', 'Est2', 'Ouest1', 'Ouest2'].forEach((k) => {
        const dest = destForKey(k)
        if (!dest) return
        ;['car', 'transit', 'bike', 'foot'].forEach((mode) => {
          const val = getVal(k, mode)
          const title = `${modeValueTitlePrefix(mode)}${dest}`
          writeValueIntoTextByTitle(title, val)
        })
      })

      const SHOW_V_TEXTS = COLOR_CONFIG.showModeValueTexts
      if (COLOR_CONFIG.applyModePictosAndValuesColor || SHOW_V_TEXTS === false) {
        const allKeys = ['Quartier', 'Nord1', 'Nord2', 'Sud1', 'Sud2', 'Est1', 'Est2', 'Ouest1', 'Ouest2']
        const allModes = ['car', 'transit', 'bike', 'foot']
        allKeys.forEach((k) => {
          const dest = destForKey(k)
          if (!dest) return
          allModes.forEach((mode) => {
            const title = `${modeValueTitlePrefix(mode)}${dest}`
            const textSel = selectTextByExactTitle(title)
            if (COLOR_CONFIG.applyModePictosAndValuesColor) {
              textSel.style('fill', THEME.modeIconsAndValues)
            }
            textSel.style('opacity', SHOW_V_TEXTS ? 1 : 0)
          })
        })

        if (COLOR_CONFIG.applyModePictosAndValuesColor) {
          const modePictoGroup = selectGroupByExactTitle('PictoQuartier')
          modePictoGroup.selectAll('path').style('fill', THEME.modeIconsAndValues)

          const pictoModesGroup = selectGroupByExactTitle('PictoModes')
          if (!pictoModesGroup.empty()) {
            const frenchPrefix = (mode: string) =>
              mode === 'car' ? 'Voiture' : mode === 'transit' ? 'Metro' : mode === 'bike' ? 'Velo' : mode === 'foot' ? 'Pieton' : ''
            allKeys.forEach((k) => {
              const dest = destForKey(k)
              if (!dest) return
              allModes.forEach((mode) => {
                const title = `${frenchPrefix(mode)}${dest}`
                const nodeSel = selectAnyByExactTitle(title, pictoModesGroup)
                nodeSel.each(function (this: Element) {
                  const el = this
                  if (el.tagName && el.tagName.toLowerCase() === 'path') {
                    d3.select(el).style('fill', THEME.modeIconsAndValues)
                  } else {
                    d3.select(el).selectAll('path').style('fill', THEME.modeIconsAndValues)
                  }
                })
              })
            })
          }
        }
      }

      const usageKeys = ['shopping', 'work', 'leisure']
      const dataKeys = ['Quartier', 'Nord1', 'Nord2', 'Sud1', 'Sud2', 'Est1', 'Est2', 'Ouest1', 'Ouest2']
      dataKeys.forEach((k) => {
        const dest = destForKey(k)
        if (!dest) return
        usageKeys.forEach((u) => {
          const v = getUsageVal(k, u)
          const factor = scaleUsageForPercent(v)
          const groupTitle = `${usageTitlePrefix(u)}${dest}`
          const g = selectGroupByExactTitle(groupTitle)
          applyCenteredPictoScale(g, factor)
          if (COLOR_CONFIG.applyUsagePictoColors) {
            g.selectAll('path').style('fill', colorForUsage(u))
          }
        })
      })

      const legendItems = {
        shopping: { picto: 'CoursesLegende', text: 'CoursesTextLegend' },
        work: { picto: 'TravailLegende', text: 'TravailTextLegend' },
        leisure: { picto: 'SortiesLegende', text: 'SortiesTextLegend' }
      }

      const setLegendHover = (targetUsage: string | null, legendGroup: d3.Selection<Element, unknown, null, undefined>) => {
        dataKeys.forEach((k) => {
          const dest = destForKey(k)
          if (!dest) return
          usageKeys.forEach((u) => {
            const t = `${usageTitlePrefix(u)}${dest}`
            const sel = selectGroupByExactTitle(t)
            if (targetUsage && u !== targetUsage) {
              sel.style('opacity', LEGEND_HOVER_DIM_OPACITY)
            } else {
              sel.style('opacity', null)
            }
          })
        })

        Object.entries(legendItems).forEach(([u, titles]) => {
          const lp = selectAnyByExactTitle(titles.picto, legendGroup)
          const lt = selectTextByExactTitle(titles.text)
          const isOther = targetUsage && u !== targetUsage
          lp.style('opacity', isOther ? LEGEND_HOVER_DIM_OPACITY : 1)
          lt.style('opacity', isOther ? LEGEND_HOVER_DIM_OPACITY : 1)
          if (targetUsage && u === targetUsage) {
            lp.selectAll('path').style('stroke', LEGEND_HOVER_STROKE).style('stroke-width', 1)
          } else {
            lp.selectAll('path').style('stroke', null).style('stroke-width', null)
          }
        })
      }

      const legendGroup = selectGroupByExactTitle('Legende')
      if (!legendGroup.empty()) {
        Object.entries(legendItems).forEach(([u, titles]) => {
          const lp = selectAnyByExactTitle(titles.picto, legendGroup)
          const lt = selectTextByExactTitle(titles.text)
          const enter = () => setLegendHover(u, legendGroup)
          const leave = () => setLegendHover(null, legendGroup)
          lp.on('mouseenter', enter).on('mouseleave', leave)
          lt.on('mouseenter', enter).on('mouseleave', leave)
        })
      }

      const modeLegendGroup = selectGroupByExactTitle('ModeLegende')
      if (!modeLegendGroup.empty()) {
        const allModes = ['car', 'transit', 'bike', 'foot']
        const modeLegendTitles = (m: string) => {
          switch (m) {
            case 'foot':
              return { picto: 'PietonLegende', text: 'PietonTextLegend' }
            case 'car':
              return { picto: 'VoitureLegende', text: 'VoitureTextLegend' }
            case 'bike':
              return { picto: 'VeloLegende', text: 'VeloTextLegend' }
            case 'transit':
              return { picto: 'MetroLegende', text: 'MetroTextLegend' }
            default:
              return { picto: '', text: '' }
          }
        }
        const colorForModeLegend = (m: string) => {
          let override: string | null = null
          switch (m) {
            case 'car':
              override = MODE_LEGEND_COLORS.car
              break
            case 'transit':
              override = MODE_LEGEND_COLORS.transit
              break
            case 'bike':
              override = MODE_LEGEND_COLORS.bike
              break
            case 'foot':
              override = MODE_LEGEND_COLORS.foot
              break
          }
          if (override && typeof override === 'string') return override
          return colorForMode(m)
        }

        allModes.forEach((m) => {
          const titles = modeLegendTitles(m)
          const picto = selectAnyByExactTitle(titles.picto, modeLegendGroup)
          const text = selectTextByExactTitle(titles.text)
          const col = colorForModeLegend(m)
          picto.selectAll('path').style('fill', col)
          text.style('fill', col)
        })

        const setModeLegendHover = (targetMode: string | null) => {
          allModes.forEach((m) => {
            const dim = !!targetMode && m !== targetMode
            svg.selectAll(`.mode-spline.mode--${m}`).style('opacity', dim ? MODE_LEGEND_HOVER_DIM_OPACITY : 1)
          })
          allModes.forEach((m) => {
            const titles = modeLegendTitles(m)
            const picto = selectAnyByExactTitle(titles.picto, modeLegendGroup)
            const text = selectTextByExactTitle(titles.text)
            const dim = !!targetMode && m !== targetMode
            picto.style('opacity', dim ? MODE_LEGEND_HOVER_DIM_OPACITY : 1)
            text.style('opacity', dim ? MODE_LEGEND_HOVER_DIM_OPACITY : 1)
            if (targetMode && m === targetMode) {
              picto.selectAll('path').style('stroke', LEGEND_HOVER_STROKE).style('stroke-width', 1)
            } else {
              picto.selectAll('path').style('stroke', null).style('stroke-width', null)
            }
          })
        }

        allModes.forEach((m) => {
          const titles = modeLegendTitles(m)
          const picto = selectAnyByExactTitle(titles.picto, modeLegendGroup)
          const text = selectTextByExactTitle(titles.text)
          const enter = () => setModeLegendHover(m)
          const leave = () => setModeLegendHover(null)
          picto.on('mouseenter', enter).on('mouseleave', leave)
          text.on('mouseenter', enter).on('mouseleave', leave)
        })
      }

      const containerEl = ref.current
      const tipEl = tooltipRef.current

      function clampToContainer(px: number, py: number): [number, number] {
        if (!containerEl || !tipEl) return [px, py]
        const { width: cw, height: ch } = containerEl.getBoundingClientRect()
        const tw = tipEl.offsetWidth || 0
        const th = tipEl.offsetHeight || 0
        let x = px + 12
        let y = py + 12
        x = Math.min(Math.max(0, x), cw - tw)
        y = Math.min(Math.max(0, y), ch - th)
        return [x, y]
      }

      const MODE_LABELS = {
        car: data?.Quartier?.modes?.car?.label || 'Voiture, moto',
        transit: data?.Quartier?.modes?.transit?.label || 'Bus, tram, métro',
        bike: data?.Quartier?.modes?.bike?.label || 'Vélo',
        foot: data?.Quartier?.modes?.foot?.label || 'Piéton'
      }

      function modeLabelForKey(key: string) {
        switch (key) {
          case 'car':
            return MODE_LABELS.car
          case 'transit':
            return MODE_LABELS.transit
          case 'bike':
            return MODE_LABELS.bike
          case 'foot':
            return MODE_LABELS.foot
          default:
            return String(key || '')
        }
      }

      function destLabelForKey(key: string) {
        switch (key) {
          case 'Quartier':
            return data?.Quartier?.destination || 'Vers quartier'
          case 'Nord1':
            return data?.Nord1?.destination || 'Vers Nord proche'
          case 'Nord2':
            return data?.Nord2?.destination || 'Vers Nord loin'
          case 'Sud1':
            return data?.Sud1?.destination || 'Vers Sud proche'
          case 'Sud2':
            return data?.Sud2?.destination || 'Vers Sud loin'
          case 'Est1':
            return data?.Est1?.destination || 'Vers Est proche'
          case 'Est2':
            return data?.Est2?.destination || 'Vers Est loin'
          case 'Ouest1':
            return data?.Ouest1?.destination || 'Vers Ouest proche'
          case 'Ouest2':
            return data?.Ouest2?.destination || 'Vers Ouest loin'
          default:
            return ''
        }
      }

      function showTip(event: MouseEvent, label: string, value: number) {
        if (!tipEl || !containerEl) return
        const valueEl = tipEl.querySelector('.tooltip-value')
        const labelEl = tipEl.querySelector('.tooltip-label')
        if (valueEl) valueEl.textContent = `${Math.round(Number(value) || 0)}%`
        if (labelEl) labelEl.textContent = String(label ?? '')
        const rect = containerEl.getBoundingClientRect()
        const px = event.clientX - rect.left
        const py = event.clientY - rect.top
        tipEl.style.display = 'block'
        const [cx, cy] = clampToContainer(px, py)
        tipEl.style.left = `${cx}px`
        tipEl.style.top = `${cy}px`
      }

      function hideTip() {
        if (!tipEl) return
        tipEl.style.display = 'none'
      }

      const originals = svg.selectAll('.mode-spline')
      originals.each(function (this: Element) {
        const node = this
        const clone = node.cloneNode(false) as Element
        const sel = d3.select(clone)
        sel.attr('class', `${node.getAttribute('class') || ''} mode-spline-hit`)
        sel
          .style('stroke', 'transparent')
          .style('fill', 'none')
          .style('stroke-width', 16)
          .style('pointer-events', 'stroke')
          .style('opacity', 1)
        node.parentNode?.insertBefore(clone, node.nextSibling)
      })

      svg
        .selectAll('.mode-spline-hit')
        .style('pointer-events', 'stroke')
        .on('mouseenter', function (this: Element, event: MouseEvent) {
          const el = this
          const cls = el.getAttribute('class') || ''
          const mode = cls.includes('mode--car')
            ? 'car'
            : cls.includes('mode--transit')
              ? 'transit'
              : cls.includes('mode--bike')
                ? 'bike'
                : cls.includes('mode--foot')
                  ? 'foot'
                  : null
          if (!mode) return
          svg.selectAll('.mode-spline').style('opacity', 0.25)
          svg.selectAll(`.mode-spline.mode--${mode}`).style('opacity', 1)

          const dest = el.getAttribute('data-dest') || d3.select((el as Element).previousSibling as Element).attr('data-dest') || ''
          const key =
            dest === 'Quartier'
              ? 'Quartier'
              : dest === 'NordProche'
                ? 'Nord1'
                : dest === 'NordLoin'
                  ? 'Nord2'
                  : dest === 'SudProche'
                    ? 'Sud1'
                    : dest === 'SudLoin'
                      ? 'Sud2'
                      : dest === 'EstProche'
                        ? 'Est1'
                        : dest === 'EstLoin'
                          ? 'Est2'
                          : dest === 'OuestProche'
                            ? 'Ouest1'
                            : dest === 'OuestLoin'
                              ? 'Ouest2'
                              : null
          const val = key ? getVal(key, mode) : 0
          const destLabel = key ? destLabelForKey(key) : String(dest)
          const modeLabel = modeLabelForKey(mode)
          showTip(event, `${destLabel} — ${modeLabel}`, val)
        })
        .on('mousemove', function (this: Element, event: MouseEvent) {
          const el = this
          const cls = el.getAttribute('class') || ''
          const mode = cls.includes('mode--car')
            ? 'car'
            : cls.includes('mode--transit')
              ? 'transit'
              : cls.includes('mode--bike')
                ? 'bike'
                : cls.includes('mode--foot')
                  ? 'foot'
                  : null
          const dest = el.getAttribute('data-dest') || d3.select((el as Element).previousSibling as Element).attr('data-dest') || ''
          const key =
            dest === 'Quartier'
              ? 'Quartier'
              : dest === 'NordProche'
                ? 'Nord1'
                : dest === 'NordLoin'
                  ? 'Nord2'
                  : dest === 'SudProche'
                    ? 'Sud1'
                    : dest === 'SudLoin'
                      ? 'Sud2'
                      : dest === 'EstProche'
                        ? 'Est1'
                        : dest === 'EstLoin'
                          ? 'Est2'
                          : dest === 'OuestProche'
                            ? 'Ouest1'
                            : dest === 'OuestLoin'
                              ? 'Ouest2'
                              : null
          const val = mode && key ? getVal(key, mode) : 0
          const destLabel = key ? destLabelForKey(key) : String(dest)
          const modeLabel = mode ? modeLabelForKey(mode) : ''
          showTip(event, `${destLabel} — ${modeLabel}`.trim(), val)
        })
        .on('mouseleave', () => {
          svg.selectAll('.mode-spline').style('opacity', null)
          hideTip()
        })

      svg.on('mouseleave', () => {
        svg.selectAll('.mode-spline').style('opacity', null)
        hideTip()
      })

      d3.select(doc.documentElement)
        .on('keydown', (event: KeyboardEvent) => {
          if (event.key === 'Tab') {
            obj.style('outline', '2px solid #005fcc')
          }
        })
        .on('keyup', (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            obj.style('outline', 'none')
          }
        })
    }

    const node = obj.node() as HTMLObjectElement | null
    let loaded = false
    const handleLoad = () => {
      if (loaded) return
      loaded = true
      try {
        onLoad()
      } catch (_) {
        // swallow
      }
    }
    node?.addEventListener('load', handleLoad)
    if (node?.contentDocument && node.contentDocument.readyState === 'complete') {
      handleLoad()
    }
    return () => {
      try {
        node?.removeEventListener('load', handleLoad)
      } catch (e) {
        // intentional no-op
      }
    }
  }, [mobilityData, vizColors])

  useEffect(() => {
    if (!mobilityData || !vizColors) return
    
    const showModeValueTexts = COLOR_CONFIG.showModeValueTexts
    
    const container = ref.current
    if (!container) return
    const objEl = container.querySelector('object')
    const doc = objEl?.contentDocument
    if (!doc) return
    const svg = d3.select(doc).select('svg')
    if (svg.empty()) return

    const SHOW = typeof showModeValueTexts === 'boolean' ? showModeValueTexts : COLOR_CONFIG.showModeValueTexts
    const modeValueTitlePrefix = (mode: string) =>
      mode === 'car' ? 'VoitureValue' : mode === 'transit' ? 'MetroValue' : mode === 'bike' ? 'VeloValue' : mode === 'foot' ? 'PietonValue' : ''
    const destForKey = (k: string) =>
      k === 'Quartier'
        ? 'Quartier'
        : k === 'Nord1'
          ? 'NordProche'
          : k === 'Nord2'
            ? 'NordLoin'
            : k === 'Sud1'
              ? 'SudProche'
              : k === 'Sud2'
                ? 'SudLoin'
                : k === 'Est1'
                  ? 'EstProche'
                  : k === 'Est2'
                    ? 'EstLoin'
                    : k === 'Ouest1'
                      ? 'OuestProche'
                      : k === 'Ouest2'
                        ? 'OuestLoin'
                        : null
    const selectTextByExactTitle = (title: string) =>
      // @ts-expect-error - D3 selection type mismatch with Element
      svg.selectAll('text').filter(function (this: Element) {
        const first = this.firstElementChild
        return !!first && first.tagName?.toLowerCase() === 'title' && (first.textContent || '').trim() === title
      })
    const allKeys = ['Quartier', 'Nord1', 'Nord2', 'Sud1', 'Sud2', 'Est1', 'Est2', 'Ouest1', 'Ouest2']
    const allModes = ['car', 'transit', 'bike', 'foot']
    allKeys.forEach((k) => {
      const dest = destForKey(k)
      if (!dest) return
      allModes.forEach((mode) => {
        const title = `${modeValueTitlePrefix(mode)}${dest}`
        selectTextByExactTitle(title).style('opacity', SHOW ? 1 : 0)
      })
    })
  }, [mobilityData, vizColors])

  // Loading state
  if (loading) {
    return (
      <div className="dv-loading-state" style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Chargement des données de mobilité...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="dv-error-state" style={{ padding: '2rem', textAlign: 'center', color: '#EF4444' }}>
        <p>Erreur: {error}</p>
      </div>
    )
  }

  // No data state
  if (!mobilityData) return null

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Mobilité: liaisons par modes et destinations"
      style={{ width: '100%', maxWidth: 800, margin: '0 auto', position: 'relative' }}
    >
      <Tooltip ref={tooltipRef} />
    </div>
  )
}

export default DvMobilityGraph
