'use client'

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { ZoomTransform } from 'd3'
import { getDpTestimonyData, type TestimonyNetworkResult, type TestimonyNode, type TestimonyLink } from '~/lib/datapacks/DpTestimony'
import { getSuColors } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds, mapGlobalToLocalIds, getSuInfoByGlobalId } from '~/lib/services/suIdMapping'

// D3 event interfaces for better type safety
interface D3ZoomEvent {
  transform: ZoomTransform
}

// (drag event typing handled via d3.D3DragEvent in callbacks to avoid TS friction)


// Types
// -----
// Using TestimonyNode from datapack as the main node type
type NodeDatum = TestimonyNode & {
  // Additional D3 properties for positioning
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
};

type LinkDatum = TestimonyLink;

// Modal component
// ---------------
function Modal({ open, onClose, node }: { open: boolean; onClose: () => void; node: NodeDatum | null }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Card sizing
  const cardWidth = 384 // ~w-96
  const cardHeight = 560
  const illustrationHeight = Math.round(cardHeight / 3)

  // Dynamic background + SU info
  const [bgColor, setBgColor] = useState<string>('#ffffff')
  const [suLocalNo, setSuLocalNo] = useState<number | null>(null)
  const [suName, setSuName] = useState<string>('')

  // Labels nodes catégories
  const SUBCATEGORY_LABELS: Record<string, string> = {
    Food: 'Alimentation',
    Housing: 'Logement',
    Politics: 'Participation citoyenne',
    Solidarity: 'Solidarité',
    NghLife: 'Vie de quartier',
    Parks: 'Parcs et espaces verts',
    Shopping: 'Réparation / Shopping',
    Services: 'Services',
    Mobility: 'Mobilité',
    General: 'Général'
  }

  const labelForSubcategory = (code?: string): string => {
    if (!code) return 'Catégorie'
    return SUBCATEGORY_LABELS[code] ?? code
  }

  const formatGenderLabel = (value?: string): string => {
    if (!value) return '—'
    const v = String(value).toLowerCase()
    if (['male', 'homme', 'm', 'masculin', 'man'].includes(v)) return 'Homme'
    if (['female', 'femme', 'f', 'féminin', 'feminin', 'woman'].includes(v)) return 'Femme'
    if (['other', 'autre', 'non-binaire', 'non binaire'].includes(v)) return 'Autre'
    return value
  }

  const formatAgeLabel = (value?: string): string => {
    if (!value) return '—'
    const map: Record<string, string> = {
      FROM_0_TO_14: '0–14 ans',
      FROM_15_TO_29: '15–29 ans',
      FROM_30_TO_44: '30–44 ans',
      FROM_45_TO_59: '45–59 ans',
      FROM_60_TO_74: '60–74 ans',
      ABOVE_75: '75 ans et +' 
    }
    const direct = map[value]
    if (direct) return direct
    const re = /^(\d{1,2})\s*[-–]\s*(\d{1,2})$/
    const m = re.exec(value)
    if (m) return `${m[1]}–${m[2]} ans`
    return value
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const isParentNode = node?.type === 'parent'
        const isChildNode = node?.type === 'child'
        if (isParentNode) {
          // Quartier palette --> parent nodes
          const qc = await getSuColors(undefined)
          if (!cancelled) setBgColor(qc.colorLight2)
        } else if (isChildNode && typeof node?.suId === 'number') {
          // SU palette --> mapping + name
          const [colors, localIds, info] = await Promise.all([
            getSuColors(node.suId),
            mapGlobalToLocalIds([node.suId]),
            getSuInfoByGlobalId(node.suId)
          ])
          if (!cancelled) {
            setBgColor(colors.colorLight2)
            setSuLocalNo(localIds?.[0] ?? null)
            setSuName(info?.name ?? '')
          }
        }
      } catch {
        if (!cancelled) {
          setBgColor('#f3f4f6') // gray-100 fallback
        }
      }
    }
    void load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [open, node?.id])

  if (!open || !node) return null;

  const isParent = node.type === 'parent'
  const isChild = node.type === 'child'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 rounded-2xl shadow-2xl border border-black/5 backdrop-blur-sm"
        style={{ width: cardWidth, height: cardHeight, backgroundColor: bgColor }}
      >
        {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-white">
              {isParent && <span className="text-xl">{node.emoji}</span>}
              <span className="font-semibold truncate max-w-[260px]">
                {isParent
                  ? labelForSubcategory(node.subcategory)
                  : (node.questionShort && node.questionShort.trim().length > 0
                      ? node.questionShort
                      : labelForSubcategory(node.group))}
              </span>
          </div>
          <button
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            onClick={onClose}
            aria-label="Fermer"
            title="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Illustration placeholder*/}
        <div
          className="mx-5 mt-4 rounded-lg border border-dashed border-white flex items-center justify-center text-gray-400 text-xs"
          style={{ height: illustrationHeight, backgroundColor: "#f3f4f6" }}
        >
          Illustration
        </div>

        {/* Main */}
        <div className="px-5 pt-4 pb-5 h-[calc(100%-theme(spacing.12)-theme(spacing.4)-theme(spacing.5)-theme(spacing.5))] overflow-y-auto">
          {/* Testimony */}
          {isChild && node.testimony && (
            <div className="mb-4">
              <div className="text-xs tracking-wide text-white mb-1">{node.respondentGenderLabel ?? formatGenderLabel(node.respondentGender)}, {node.respondentAgeLabel ?? formatAgeLabel(node.respondentAge)}, S.U. n°{suLocalNo ?? '?'} &quot;{suName}&quot; :</div>
                <div className="bg-white p-4 rounded-lg">
                <p className="text-gray-800 italic leading-relaxed">&ldquo;{node.testimony}&rdquo;</p>
              </div>
            </div>
          )}

          {/* Parent info si témoignage */}
          {isParent && (
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Thème</div>
              <div className="bg-gray-50 border p-4 rounded-lg flex items-center gap-3">
                <span className="text-2xl">{node.emoji}</span>
                <div className="font-semibold">{node.subcategory}</div>
              </div>
            </div>
          )}
         
        </div>
      </div>
    </div>
  );
}

// D3 Force-Directed Graph Component
// ---------------------------------
interface DvTestimonyNetworkProps {
  selectedSus?: number[] // 
}

const DvTestimonyNetwork: React.FC<DvTestimonyNetworkProps> = ({
  selectedSus
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const svgContainer = useRef<HTMLDivElement | null>(null)
  const [nodes, setNodes] = useState<NodeDatum[]>([])
  const [links, setLinks] = useState<LinkDatum[]>([])
  const [selectedNode, setSelectedNode] = useState<NodeDatum | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [networkData, setNetworkData] = useState<TestimonyNetworkResult | null>(null)
  const [loading, setLoading] = useState(true)

  // colors 
  const [mainColor, setMainColor] = useState<string>('#002878')
  const [lightColor1, setLightColor1] = useState<string>('#99AAFF')
  const [lightColor3, setLightColor3] = useState<string>('#6677DD')
  
  // Consistance couleurs par Su pour les Nodes dans la vue quartier
  const [suColorMap, setSuColorMap] = useState<Record<number, string>>({})

  // Quartier base color (used for parent nodes regardless of view)
  const [quartierMainColor, setQuartierMainColor] = useState<string>('#002878')

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
    getSvgContainerSize()
    // resize observer/listener
    window.addEventListener("resize", getSvgContainerSize)
    return () => window.removeEventListener("resize", getSvgContainerSize)
  }, [])

  useEffect(() => {
    if (svgContainer.current && (!width || !height)) {
      const timer = setTimeout(() => {
        getSvgContainerSize()
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [width, height])

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        console.log('Chargement des témoignages format Network Graph...', { selectedSus })
        const data = await getDpTestimonyData(selectedSus)
        setNetworkData(data)
        setNodes(data.nodes.map(node => ({ ...node }))) // --> D3
        setLinks(data.links)
        console.log('Témoingages chargés !', {
          nodes: data.nodes.length,
          links: data.links.length,
          testimonies: data.totalTestimonies
        })
      } catch (error) {
        console.error('Erreur au chargement des témoignages:', error)
        setNodes([])
        setLinks([])
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedSus])

  // Load SU colors --> nodes/links
  useEffect(() => {
    const loadColors = async () => {
      try {
        let globalSuId: number | undefined = undefined
        if (selectedSus && selectedSus.length === 1 && selectedSus[0] !== undefined) {
          const globalIds = await mapLocalToGlobalIds([selectedSus[0]])
          globalSuId = globalIds[0]
          console.log(`🎨 Mapping couleur: SU locale ${selectedSus[0]} → SU globale ${globalSuId}`)
        }

        const [suColors, quartierColors] = await Promise.all([
          getSuColors(globalSuId),
          getSuColors(undefined)
        ])
        if (suColors?.colorMain) setMainColor(suColors.colorMain)
        if (suColors?.colorLight1) setLightColor1(suColors.colorLight1)
        if (suColors?.colorLight3) setLightColor3(suColors.colorLight3)
        if (quartierColors?.colorMain) setQuartierMainColor(quartierColors.colorMain)
        console.log('Couleurs SU chargées')
        console.log('Couleur Quartier')
      } catch (error) {
        console.warn('Impossible de charger les couleurs SU', error)
      }
    }

    void loadColors()
  }, [selectedSus])

  // Preload SU colors --> child nodes vue quartier
  useEffect(() => {
    const loadSuColorsForQuartier = async () => {
      try {
        if (!networkData?.isQuartier) {
          setSuColorMap({})
          return
        }
        // Unique SU IDs from child nodes
        const suIds = Array.from(new Set(
          nodes
            .filter(n => n.type === 'child' && typeof n.suId === 'number')
            .map(n => n.suId!)
        ))
        if (suIds.length === 0) {
          setSuColorMap({})
          return
        }
        const entries = await Promise.all(
          suIds.map(async (id) => {
            try {
              const colors = await getSuColors(id)
              return [id, colors.colorMain] as const
            } catch {
              return [id, undefined] as const
            }
          })
        )
        const map: Record<number, string> = {}
        entries.forEach(([id, color]) => {
          if (color) map[id] = color
        })
        setSuColorMap(map)
      } catch (err) {
        console.warn('⚠️ Impossible de précharger SU colors dans vue quartier', err)
        setSuColorMap({})
      }
    }
    void loadSuColorsForQuartier()
  }, [networkData?.isQuartier, nodes])

  useEffect(() => {
    if (!svgRef.current) return;


    // fallback dimensions
    const fallbackWidth = 960
    const fallbackHeight = 600
    
    // Dimensions
    const dimensions = {
      width: width ?? fallbackWidth,
      height: height ?? fallbackHeight,
      margins: { top: 20, right: 20, bottom: 20, left: 20 }
    }

    // deep copy / mutating props
    const nodesCopy = nodes.map((d) => ({ ...d }));
    const linksCopy = links.map((d) => ({ ...d }));

  const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // clear before redraw
    
    // Set SVG dimensions
    svg
      .attr('width', dimensions.width)
      .attr('height', dimensions.height - 80)

    // arrowheads
    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 18)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", lightColor3);

    // container for zoom
    const g = svg.append("g").attr("class", "g-zoom-root");

    // zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event: D3ZoomEvent) => {
        g.attr("transform", event.transform.toString());
      });

    svg.call(zoom);

    // Prepare link force with proper id accessor and safe cast to Force<NodeDatum, undefined>
    const linkForce = d3
      .forceLink<NodeDatum, LinkDatum>(linksCopy)
      .id((d: NodeDatum) => d.id)
      .distance(150) as unknown as d3.Force<NodeDatum, undefined>

    // Create force simulation early so drag handlers can reference it
    const simulation = d3
      .forceSimulation<NodeDatum>(nodesCopy)
      .force("link", linkForce)
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collision", d3.forceCollide().radius(50))

    // Build adjacency map for hover highlighting
    const neighborMap = new Map<string, Set<string>>();
    type D3Linkish = { source: unknown; target: unknown }
    const hasId = (x: unknown): x is { id: string | number } => typeof x === 'object' && x !== null && 'id' in x
    const getId = (x: unknown): string => {
      if (typeof x === 'string' || typeof x === 'number') return String(x)
      if (hasId(x)) return String(x.id)
      return ''
    }
    const addNeighbor = (a: string, b: string) => {
      if (!neighborMap.has(a)) neighborMap.set(a, new Set<string>())
      neighborMap.get(a)!.add(b)
    }
    linksCopy.forEach((l) => {
      const linkish = l as unknown as D3Linkish
      const s = getId(linkish.source)
      const t = getId(linkish.target)
      if (s && t) {
        addNeighbor(s, t)
        addNeighbor(t, s)
      }
    })

    // link lines
    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll<SVGLineElement, D3Linkish>("line")
      .data(linksCopy as unknown as D3Linkish[])
      .join("line")
      .attr("stroke", lightColor3)
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    // node groups
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, NodeDatum>("g")
      .data(nodesCopy)
      .join("g")
      .attr("class", "node-group")
      .call(
        d3
          .drag<SVGGElement, NodeDatum>()
          .on("start", function (event: d3.D3DragEvent<SVGGElement, NodeDatum, unknown>, d: NodeDatum) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", function (event: d3.D3DragEvent<SVGGElement, NodeDatum, unknown>, d: NodeDatum) {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", function (event: d3.D3DragEvent<SVGGElement, NodeDatum, unknown>, d: NodeDatum) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = event.x;
            d.fy = event.y;
          })
      )
      .on("mouseover", function (event: MouseEvent, d: NodeDatum) {
        const keep = new Set<string>([d.id])
        const neigh = neighborMap.get(d.id)
        if (neigh) neigh.forEach((id) => keep.add(id))
        node.attr("opacity", (n: NodeDatum) => (keep.has(n.id) ? 1 : 0.15))
        link.attr("stroke-opacity", (l: D3Linkish) => {
          const s = getId(l.source)
          const t = getId(l.target)
          return s === d.id || t === d.id || (keep.has(s) && keep.has(t)) ? 0.9 : 0.1
        })
      })
      .on("mouseout", function () {
        node.attr("opacity", 1)
        link.attr("stroke-opacity", 0.6)
      })
      .on("click", function (event: MouseEvent, d: NodeDatum) {
        // Stop propagation to prevent the SVG background click from closing the modal immediately
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        setSelectedNode(d);
        setIsModalOpen(true);
      });

    // circles
    node
      .append("circle")
      .attr("r", (d) => (d.type === 'parent' ? 40 : 14))
      .attr("fill", (d) => {
        if (d.type === 'parent') return quartierMainColor

        if (networkData?.isQuartier && typeof d.suId === 'number') {
          return suColorMap[d.suId] ?? lightColor1
        }
        return lightColor1
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer");

    // Side labels for child nodes
    node
      .filter(d => d.type !== 'parent')
      .append("text")
      .attr("x", 18)
      .attr("y", 4)
      .text((d) => d.label ?? d.id)
      .attr("font-size", 12)
      .attr("pointer-events", "auto")
      .attr("cursor", "pointer");

    // Emoji inside parent nodes (ensure these are appended last for stacking)
    node
      .filter(d => d.type === 'parent')
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", 40)
      .attr("pointer-events", "none")
      .text(d => d.emoji ?? '💬');

    // tick handler after elements exist
    type NodePosish = { x?: number; y?: number }
    const hasXY = (v: unknown): v is NodePosish => typeof v === 'object' && v !== null && ('x' in v || 'y' in v)
    simulation.on("tick", () => {
      link
        .attr("x1", (d: D3Linkish) => (hasXY(d.source) && typeof d.source.x === 'number' ? d.source.x : 0))
        .attr("y1", (d: D3Linkish) => (hasXY(d.source) && typeof d.source.y === 'number' ? d.source.y : 0))
        .attr("x2", (d: D3Linkish) => (hasXY(d.target) && typeof d.target.x === 'number' ? d.target.x : 0))
        .attr("y2", (d: D3Linkish) => (hasXY(d.target) && typeof d.target.y === 'number' ? d.target.y : 0));

      node.attr("transform", (d: NodeDatum) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // helper: color scale
    // No colorOf() needed anymore: theming handled via DpColor SU colors

    // on click background to deselect
    svg.on("click", () => {
      setSelectedNode(null);
      setIsModalOpen(false);
    });

    // cleanup on unmount
    return () => {
      simulation.stop();
      svg.selectAll("*").remove();
    };
  }, [nodes, links, width, height, mainColor, lightColor1, lightColor3, networkData?.isQuartier, suColorMap, quartierMainColor]);

  return (
    <div ref={svgContainer} className="w-full h-full">
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <h3 className="text-lg font-semibold">🗣 Carte mentale des témoignages</h3>
        <div className="space-x-2">
          {loading && (
            <span className="px-3 py-1 text-xs text-gray-500">
              Chargement...
            </span>
          )}
          {!loading && networkData && (
            <span className="px-3 py-1 text-xs text-gray-600">
              {networkData.totalTestimonies} témoignages • {networkData.subcategories.length} thêmes
            </span>
          )}
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
            onClick={async () => {
              setLoading(true)
              try {
                const data = await getDpTestimonyData(selectedSus)
                setNetworkData(data)
                setNodes(data.nodes.map(node => ({ ...node })))
                setLinks(data.links)
              } catch (error) {
                console.error('Error reloading data:', error)
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
          >
            Ré-initialiser
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 pb-4">
        <svg ref={svgRef} className="w-full h-full border rounded-lg" />
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        node={selectedNode}
      />

      <div className="px-4 pb-2 text-xs text-gray-600">
        (●) Cliquez pour les détails d&apos;un témoignage. ☩ Faites glisser pour vous déplacer dans la carte. ↕ Scrollez pour zoomer (utilisez  la molette de la souris).
      </div>
    </div>
  );
}

export { DvTestimonyNetwork }
export default DvTestimonyNetwork