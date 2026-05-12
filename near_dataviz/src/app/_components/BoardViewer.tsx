'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'

interface BoardViewerProps {
  children: React.ReactNode
  isZoneSelectMode?: boolean
  onZoneCapture?: (canvas: HTMLCanvasElement, zoneLabel?: string) => void
  onBoardReady?: (ready: boolean) => void
}

interface HighlightBox {
  top: number
  left: number
  width: number
  height: number
}

// BoardViewer : conteneur central des boards
/* - Fournit un conteneur à largeur fixe pour les Boards
   - Tous les Boards utilisent 100 % de l'espace disponible dans ce visualiseur
   - En mode zone-select, un overlay détecte les .dv-container survolés et permet de les capturer */

const BoardViewer: React.FC<BoardViewerProps> = ({ children, isZoneSelectMode = false, onZoneCapture, onBoardReady }) => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [highlight, setHighlight] = useState<HighlightBox | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const targetRef = useRef<HTMLElement | null>(null)
  const [overlayHeight, setOverlayHeight] = useState<number | undefined>()

  // Ref vers le callback pour que la closure du MutationObserver appelle toujours
  // la version la plus récente sans avoir besoin d'être recréée.
  const onBoardReadyRef = useRef(onBoardReady)
  useEffect(() => { onBoardReadyRef.current = onBoardReady }, [onBoardReady])

  // MutationObserver : surveille le wrapper pour détecter l'apparition de SVG avec du contenu.
  // Quand au moins un <svg> peuplé existe, les graphiques D3 sont rendus.
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const checkReady = () => {
      const svgs = wrapper.querySelectorAll<SVGSVGElement>('svg')
      // Prêt quand au moins un SVG contient des éléments dessinés (pas juste le squelette vide)
      const ready = Array.from(svgs).some(svg => svg.childElementCount > 0)
      onBoardReadyRef.current?.(ready)
    }

    const observer = new MutationObserver(checkReady)
    observer.observe(wrapper, { childList: true, subtree: true })
    // Vérification immédiate au cas où le contenu est déjà rendu (ex. cache rapide)
    checkReady()

    return () => observer.disconnect()
  }, [])

  // Mesure la hauteur visuelle réelle du board, y compris le contenu qui déborde avec
  // overflow:visible (ex. EmdvPieCharts). scrollHeight ne voit que la hauteur résolue en CSS
  // (= 100vh pour other-board avec height:100%), pas le contenu rendu en dessous.
  const measureVisualHeight = useCallback((wrapper: HTMLElement): number => {
    const wrapperTop = wrapper.getBoundingClientRect().top
    const scrollTop = wrapper.scrollTop
    // On part de scrollHeight — correct pour les boards qui scrollent normalement
    let maxH = wrapper.scrollHeight
    // Parcours des éléments structurels pour détecter le contenu en overflow:visible
    const candidates = wrapper.querySelectorAll<HTMLElement>(
      '.board-content, .other-board, .demographie-board, .board-grid, .dv-container'
    )
    for (const el of candidates) {
      const r = el.getBoundingClientRect()
      // Bas de l'élément dans le repère interne du wrapper
      const absBottom = r.bottom - wrapperTop + scrollTop
      if (absBottom > maxH) maxH = absBottom
    }
    return Math.ceil(maxH) + 30 // +30 pour marge de sécurité en bas
  }, [])

  // Quand le mode zone-select s'active, on mesure la hauteur visuelle complète du board
  // pour que l'overlay la couvre entièrement (position:absolute inset:0 ne couvre que
  // la hauteur visible dans un conteneur overflow-y:auto).
  useEffect(() => {
    if (isZoneSelectMode && wrapperRef.current) {
      setOverlayHeight(measureVisualHeight(wrapperRef.current))
    } else {
      setOverlayHeight(undefined)
    }
  }, [isZoneSelectMode, measureVisualHeight])

  const getRelativeBox = (el: HTMLElement, wrapper: HTMLElement): HighlightBox => {
    const elRect = el.getBoundingClientRect()
    const wrapperRect = wrapper.getBoundingClientRect()
    return {
      top: elRect.top - wrapperRect.top + wrapper.scrollTop,
      left: elRect.left - wrapperRect.left,
      width: elRect.width,
      height: elRect.height,
    }
  }

  const findTarget = useCallback((x: number, y: number): HTMLElement | null => {
    const overlay = overlayRef.current
    const wrapper = wrapperRef.current
    if (!overlay || !wrapper) return null

    // On masque temporairement l'overlay pour que elementFromPoint atteigne le contenu réel
    overlay.style.pointerEvents = 'none'
    const el = document.elementFromPoint(x, y)
    overlay.style.pointerEvents = 'auto'

    if (!el) return null

    // Remonte le DOM jusqu'au premier ancêtre .dv-container ou .zone-target
    let node: HTMLElement | null = el as HTMLElement
    while (node && node !== wrapper) {
      if (node.classList.contains('dv-container') || node.classList.contains('zone-target')) return node
      node = node.parentElement
    }

    // Repli : tout le .board-content
    const boardContent = wrapper.querySelector<HTMLElement>('.board-content')
    return boardContent ?? wrapper
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoneSelectMode || isCapturing) return
    const target = findTarget(e.clientX, e.clientY)
    if (!target || !wrapperRef.current) return
    targetRef.current = target
    setHighlight(getRelativeBox(target, wrapperRef.current))
  }, [isZoneSelectMode, isCapturing, findTarget])

  const handleMouseLeave = useCallback(() => {
    if (!isCapturing) {
      setHighlight(null)
      targetRef.current = null
    }
  }, [isCapturing])

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoneSelectMode || isCapturing || !onZoneCapture) return
    e.stopPropagation()

    const target = findTarget(e.clientX, e.clientY)
    const wrapper = wrapperRef.current
    if (!target || !wrapper) return

    setIsCapturing(true)
    setHighlight(null)

    try {
      const { default: html2canvasRaw } = await import('html2canvas')
      const html2canvas = html2canvasRaw as (element: HTMLElement, options?: unknown) => Promise<HTMLCanvasElement>
      const scale = window.devicePixelRatio && window.devicePixelRatio > 1 ? window.devicePixelRatio : 2

      // On capture toujours l'intégralité du board-content pour éviter le clipping
      // lié au scroll/overflow sur les sous-éléments.
      const boardContent = wrapper.querySelector<HTMLElement>('.board-content') ?? wrapper

      // On utilise la hauteur visuelle plutôt que scrollHeight : les boards avec
      // other-board (height:100% + overflow:visible) ont scrollHeight = 100vh,
      // ce qui tronquerait le contenu sous la ligne de flottaison (ex. EmdvPieCharts).
      const captureHeight = measureVisualHeight(wrapper)

      const fullCanvas = await html2canvas(boardContent, {
        useCORS: true,
        backgroundColor: '#ffffff',
        scale,
        logging: false,
        width: boardContent.offsetWidth,
        height: captureHeight,
        // On utilise la taille RÉELLE du viewport pour que les unités vh/vw du clone
        // se résolvent de façon identique au DOM affiché. La hauteur du canvas de sortie
        // est contrôlée séparément par `height: captureHeight` ; windowHeight n'affecte
        // que le calcul CSS — si on le fixait à captureHeight, chaque élément 100vh
        // deviendrait captureHeight px dans le clone, décalant toutes les positions.
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        onclone: (_doc: Document, clonedEl: HTMLElement) => {
          // Parcours tous les ancêtres depuis board-viewer jusqu'au <body> pour supprimer
          // tout clipping par overflow. Notamment .dataviz-dashboard (overflow:hidden)
          // et .dashboard-grid (height:100vh) tronqueraient le rendu à ~100vh.
          let node: HTMLElement | null = clonedEl.parentElement
          while (node && node.tagName !== 'BODY') {
            if (node === clonedEl.parentElement) {
              // board-viewer : on l'étend à la hauteur de capture complète
              node.style.height = captureHeight + 'px'
            }
            node.style.overflow = 'visible'
            node.style.overflowX = 'visible'
            node.style.overflowY = 'visible'
            node.style.minHeight = captureHeight + 'px'
            node = node.parentElement
          }
          // On libère height:100% sur les éléments de mise en page pour que le contenu
          // se développe naturellement
          clonedEl.querySelectorAll<HTMLElement>('.other-board, .demographie-board').forEach(b => {
            b.style.height = 'auto'
            b.style.minHeight = captureHeight + 'px'
          })
        },
      })

      let resultCanvas: HTMLCanvasElement

      if (target === boardContent || target === wrapper) {
        // Board entier sélectionné — on utilise le canvas directement
        resultCanvas = fullCanvas
      } else {
        // Recadrage sur les limites de l'élément cible.
        // getBoundingClientRect() est relatif au viewport pour les deux rects.
        // boardRect.top reflète déjà le scroll (il devient négatif quand board-viewer
        // défile), donc targetRect.top - boardRect.top donne directement le bon offset
        // depuis le haut du boardContent dans le canvas complet.
        const boardRect  = boardContent.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()

        const cropX = Math.round((targetRect.left - boardRect.left) * scale)
        const cropY = Math.round((targetRect.top  - boardRect.top)  * scale)
        const cropW = Math.round(targetRect.width  * scale)
        const cropH = Math.round(targetRect.height * scale)

        const croppedCanvas = document.createElement('canvas')
        croppedCanvas.width  = cropW
        croppedCanvas.height = cropH
        const ctx = croppedCanvas.getContext('2d')
        ctx?.drawImage(fullCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
        resultCanvas = croppedCanvas
      }

      // Dérivation d'un libellé lisible pour le nom de fichier.
      // 1. Cherche un <svg> <title> ou un titre dans l'élément.
      // 2. Repli sur la classe de zone (ex. "usages-dist").
      let zoneLabel: string | undefined
      if (target !== boardContent && target !== wrapper) {
        const heading = target.querySelector<HTMLElement>('h1,h2,h3,h4,[class*="title"],text')
        const headingText = heading?.textContent?.trim()
        if (headingText && headingText.length < 60) {
          zoneLabel = headingText
        } else {
          // Classe de zone : on retire les classes marqueurs et on prend la première restante
          const areaClass = Array.from(target.classList)
            .find(c => c !== 'dv-container' && c !== 'zone-target')
          if (areaClass) zoneLabel = areaClass.replace(/-dist$/, '')
        }
      }

      onZoneCapture(resultCanvas, zoneLabel)
    } catch (err) {
      console.error('Erreur lors de la capture de zone', err)
    } finally {
      setIsCapturing(false)
    }
  }, [isZoneSelectMode, isCapturing, onZoneCapture, findTarget, measureVisualHeight])

  return (
    <div
      className={`board-viewer${isZoneSelectMode ? ' zone-select-active' : ''}`}
      ref={wrapperRef}
      style={{ position: 'relative' }}
    >
      <div className="board-content">
        {children}
      </div>

      {isZoneSelectMode && (
        <>
          {/* Overlay that intercepts hover/click */}
          <div
            ref={overlayRef}
            className="zone-select-overlay"
            style={overlayHeight !== undefined ? { height: overlayHeight } : undefined}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => { void handleClick(e) }}
          />

          {/* Highlight box drawn over hovered zone */}
          {highlight && !isCapturing && (
            <div
              className="zone-highlight"
              style={{
                top: highlight.top,
                left: highlight.left,
                width: highlight.width,
                height: highlight.height,
              }}
            />
          )}

          {/* Capturing feedback */}
          {isCapturing && (
            <div className="zone-capturing-overlay">
              <span>Capture en cours…</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default BoardViewer