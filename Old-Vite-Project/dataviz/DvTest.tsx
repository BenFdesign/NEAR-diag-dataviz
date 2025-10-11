import React from 'react'

type Labels = {
  usageSphere: string
  qualiteDeVie: string
  nosGEStesClimat: string
  popPercentage: string
}

type Row = {
  suId: number
  nameFr: string
  usageSphere: number
  qualiteDeVie: number
  nosGEStesClimat: number
  popPercentage: number | null
}

type Warning = { dataset: string; suId: number }

type AnyPayload = {
  headers?: Labels
  labels?: Labels
  rows?: Row[]
  missingForeignKeys?: Warning[]
  warnings?: Warning[]
}

type Props = {
  data: string | AnyPayload
  width?: number | string
  height?: number | string
}

export default function DvTest({ data, width = '100%', height = 'auto' }: Props) {
  let payload: AnyPayload
  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data) as AnyPayload
    } catch {
      payload = {}
    }
  } else {
    payload = data
  }

  const headers: Labels = (payload.headers ?? payload.labels) ?? {
    usageSphere: "Test",
    qualiteDeVie: 'Qualité de Vie',
    nosGEStesClimat: 'Nos GEStes Climat',
    popPercentage: '% pop',
  }
  const rows: Row[] = payload.rows ?? []
  const missingForeignKeys: Warning[] = payload.missingForeignKeys ?? payload.warnings ?? []

  const style: React.CSSProperties = {
    width,
    height,
    overflow: 'auto',
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: 12,
  }

  return (
    <div style={style}>
      {missingForeignKeys.length > 0 && (
        <div style={{ marginBottom: 8, color: '#b45309' }}>
          Missing foreign keys: {missingForeignKeys.map((m) => `${m.dataset} → ${m.suId}`).join(', ')}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Su Id</th>
            <th style={th}>Name Fr</th>
            <th style={th}>{headers.usageSphere}</th>
            <th style={th}>{headers.qualiteDeVie}</th>
            <th style={th}>{headers.nosGEStesClimat}</th>
            <th style={th}>{headers.popPercentage}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.suId}>
              <td style={td}>{r.suId}</td>
              <td style={td}>{r.nameFr}</td>
              <td style={td}>{r.usageSphere}</td>
              <td style={td}>{r.qualiteDeVie}</td>
              <td style={td}>{r.nosGEStesClimat}</td>
              <td style={td}>{r.popPercentage == null ? '' : r.popPercentage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '1px solid #eee',
  position: 'sticky',
  top: 0,
  background: '#fafafa',
}

const td: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid #f2f2f2',
}
