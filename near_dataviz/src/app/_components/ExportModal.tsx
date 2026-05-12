'use client'

import { useEffect, useCallback } from 'react'

interface ExportModalProps {
  canvas: HTMLCanvasElement
  onClose: () => void
  onChangeVisualization: () => void
  boardName?: string
  suLabel?: string
  zoneLabel?: string
}

// Build a safe filename segment: lowercase, accents stripped, spaces to hyphens
const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export default function ExportModal({ canvas, onClose, onChangeVisualization, boardName, suLabel, zoneLabel }: ExportModalProps) {
  const previewUrl = canvas.toDataURL('image/png')

  const handleDownloadPng = () => {
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const ts = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      const parts = ['near-dataviz']
      if (suLabel) parts.push(slugify(suLabel))
      if (boardName) parts.push(slugify(boardName))
      if (zoneLabel) parts.push(slugify(zoneLabel))
      parts.push(ts)
      link.href = url
      link.download = parts.join('_') + '.png'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="export-modal-backdrop" onClick={onClose}>
      <div
        className="export-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Exporter la visualisation"
      >
        {/* Header */}
        <div className="export-modal-header">
          <div className="export-modal-title-block">
            <span className="export-modal-title">Aperçu de l&apos;export</span>
            {(suLabel ?? boardName ?? zoneLabel) && (
              <span className="export-modal-subtitle">
                {[suLabel, boardName, zoneLabel].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <button
            className="export-modal-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {/* Preview */}
        <div className="export-modal-preview-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Aperçu de la zone sélectionnée"
            className="export-modal-preview"
          />
        </div>

        {/* Actions */}
        <div className="export-modal-actions">
          <button
            className="export-modal-btn export-modal-btn--secondary"
            onClick={onChangeVisualization}
          >
            Changer de visualisation
          </button>
          <button
            className="export-modal-btn export-modal-btn--primary"
            onClick={handleDownloadPng}
          >
            ⬇️ Télécharger PNG
          </button>
        </div>
      </div>
    </div>
  )
}
