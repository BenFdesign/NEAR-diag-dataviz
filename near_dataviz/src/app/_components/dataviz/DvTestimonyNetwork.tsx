'use client'

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { ZoomTransform } from 'd3'
import { getDpTestimonyData, type TestimonyNetworkResult, type TestimonyNode, type TestimonyLink } from '~/lib/datapacks/DpTestimony'
import { getSuColors } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

// D3 event interfaces for better type safety
interface D3ZoomEvent {
  transform: ZoomTransform
}

// (drag event typing handled via d3.D3DragEvent in callbacks to avoid TS friction)

// TestimonyNetworkComponent.tsx
// A React component that renders a D3 force-directed network graph from real testimony data.
// Shows testimony nodes linked to their thematic parent categories with modal popups.

// -----------------------------
// Types
// -----------------------------
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

// -----------------------------
// Modal component for testimony details
// -----------------------------
function Modal({ open, onClose, node }: { open: boolean; onClose: () => void; node: NodeDatum | null }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !node) return null;

  // Differentiate between parent and child nodes
  const isParent = node.type === 'parent'
  const isChild = node.type === 'child'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-w-4xl w-full mx-4 bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold flex items-center gap-2">
              {isParent ? (
                <>
                  <span className="text-2xl">{node.emoji}</span>
                  <span>Catégorie: {node.subcategory}</span>
                </>
              ) : (
                <>
                  <span className="text-blue-600">💬</span>
                  <span>Témoignage</span>
                </>
              )}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {isParent ? `Parent node - ${node.subcategory}` : `SU ${node.suId} - ${node.group}`}
            </p>
          </div>
          <button
            className="text-gray-500 hover:text-gray-700 text-xl"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="mt-6">
          {isChild && node.testimony && (
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3">📝 Témoignage</h4>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <p className="text-gray-800 italic leading-relaxed">&ldquo;{node.testimony}&rdquo;</p>
              </div>
            </div>
          )}

          {isChild && (
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3">👤 Profil du répondant</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 border rounded-lg p-3">
                  <div className="text-sm text-gray-600">SU (Secteur Urbain)</div>
                  <div className="font-semibold text-lg">{node.suId}</div>
                </div>
                <div className="bg-gray-50 border rounded-lg p-3">
                  <div className="text-sm text-gray-600">Genre</div>
                  <div className="font-semibold">{node.respondentGender}</div>
                </div>
                <div className="bg-gray-50 border rounded-lg p-3">
                  <div className="text-sm text-gray-600">Tranche d&apos;âge</div>
                  <div className="font-semibold">{node.respondentAge}</div>
                </div>
                <div className="bg-gray-50 border rounded-lg p-3">
                  <div className="text-sm text-gray-600">Catégorie socio-professionnelle</div>
                  <div className="font-semibold">{node.respondentCsp}</div>
                </div>
              </div>
            </div>
          )}

          {isParent && (
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3">📊 Catégorie thématique</h4>
              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{node.emoji}</span>
                  <div>
                    <div className="font-semibold text-lg">{node.subcategory}</div>
                    <div className="text-sm text-gray-600">Nœud parent - regroupe les témoignages de cette catégorie</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <h5 className="font-medium text-sm text-gray-600 mb-2">Détails techniques</h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">ID</div>
                <div className="font-mono break-all">{node.id}</div>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">Type</div>
                <div className="font-semibold">{node.type}</div>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">Groupe</div>
                <div className="font-semibold">{node.group}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Main TestimonyNetwork component
// -----------------------------
interface DvTestimonyNetworkProps {
  selectedSus?: number[] // Keep interface consistent but not used
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

  // SU-themed colors (like DvGenre)
  const [mainColor, setMainColor] = useState<string>('#002878')
  const [lightColor1, setLightColor1] = useState<string>('#99AAFF')
  const [lightColor3, setLightColor3] = useState<string>('#6677DD')

  // In quartier view, child nodes must use their own SU color
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
      console.log('📐 DvTestimonyNetwork dimensions updated:', { width: newWidth, height: newHeight })
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

  // Additional effect to ensure dimensions are set after component mounts
  useEffect(() => {
    if (svgContainer.current && (!width || !height)) {
      // Small delay to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        getSvgContainerSize()
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [width, height])

  // Load testimony data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        console.log('📊 Chargement des témoignages format Network Graph...', { selectedSus })
        const data = await getDpTestimonyData(selectedSus)
        setNetworkData(data)
        setNodes(data.nodes.map(node => ({ ...node }))) // Add D3 properties
        setLinks(data.links)
        console.log('✅ Témoingages chargés !', {
          nodes: data.nodes.length,
          links: data.links.length,
          testimonies: data.totalTestimonies
        })
      } catch (error) {
        console.error('❌ Erreur au chargement des témoignages:', error)
        // Set empty data on error
        setNodes([])
        setLinks([])
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedSus])

  // Load SU colors (like DvGenre) for theming nodes/links
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
        console.log('🎨 Couleurs SU chargées:', {
          main: suColors.colorMain,
          light1: suColors.colorLight1,
          light3: suColors.colorLight3,
        })
        console.log('🎨 Couleur Quartier:', quartierColors.colorMain)
      } catch (error) {
        console.warn('⚠️ Impossible de charger les couleurs SU, utilisation des valeurs par défaut', error)
      }
    }

    void loadColors()
  }, [selectedSus])

  // Preload SU colors for all child nodes in quartier view
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
        console.warn('⚠️ Impossible de précharger les couleurs SU pour la vue quartier', err)
        setSuColorMap({})
      }
    }
    void loadSuColorsForQuartier()
  }, [networkData?.isQuartier, nodes])

  useEffect(() => {
    if (!svgRef.current) return;


    // Use fallback dimensions if responsive dimensions not yet available
    const fallbackWidth = 960
    const fallbackHeight = 600
    
    // Dimensions following ResponsiveD3 pattern
    const dimensions = {
      width: width ?? fallbackWidth,
      height: height ?? fallbackHeight,
      margins: { top: 20, right: 20, bottom: 20, left: 20 }
    }

    // Dimensions calculated but not used for force-directed graph

    // deep copy to avoid mutating props
    const nodesCopy = nodes.map((d) => ({ ...d }));
    const linksCopy = links.map((d) => ({ ...d }));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // clear before redraw
    
    // Set SVG dimensions
    svg
      .attr('width', dimensions.width)
      .attr('height', dimensions.height - 80)

    // defs for arrowheads (optional)
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
      .distance(100) as unknown as d3.Force<NodeDatum, undefined>

    // Create force simulation early so drag handlers can reference it
    const simulation = d3
      .forceSimulation<NodeDatum>(nodesCopy)
      .force("link", linkForce)
      .force("charge", d3.forceManyBody().strength(-50))
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collision", d3.forceCollide().radius(25))

    // link lines
    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(linksCopy)
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
      .on("click", function (event: MouseEvent, d: NodeDatum) {
        // Stop propagation to prevent the SVG background click from closing the modal immediately
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        setSelectedNode(d);
        setIsModalOpen(true);
      });

    // circles
    node
      .append("circle")
      .attr("r", (d) => (d.type === 'parent' ? 26 : 14))
      .attr("fill", (d) => {
        if (d.type === 'parent') return quartierMainColor
        // Quartier mode: color children by their own SU color
        if (networkData?.isQuartier && typeof d.suId === 'number') {
          return suColorMap[d.suId] ?? lightColor1
        }
        return lightColor1
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer");

    // Emoji inside parent nodes
    node
      .filter(d => d.type === 'parent')
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", 16)
      .attr("pointer-events", "none")
      .text(d => d.emoji ?? '🧩');

    // Side labels for child nodes
    node
      .filter(d => d.type !== 'parent')
      .append("text")
      .attr("x", 18)
      .attr("y", 4)
      .text((d) => d.label ?? d.id)
      .attr("font-size", 12)
      .attr("pointer-events", "none");

    // tick handler after elements exist
    simulation.on("tick", () => {
      link
        .attr("x1", (d: TestimonyLink) => (d.source as unknown as NodeDatum).x ?? 0)
        .attr("y1", (d: TestimonyLink) => (d.source as unknown as NodeDatum).y ?? 0)
        .attr("x2", (d: TestimonyLink) => (d.target as unknown as NodeDatum).x ?? 0)
        .attr("y2", (d: TestimonyLink) => (d.target as unknown as NodeDatum).y ?? 0);

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