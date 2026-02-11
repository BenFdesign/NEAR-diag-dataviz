// Generic contract types for datapacks (see docs/datapacks.md, section 7)

export type DatapackView = 'quartier' | 'su'

export interface DatapackRequest {
  selectedSus?: number[]
  view?: 'auto' | DatapackView
  signal?: AbortSignal
  extra?: Record<string, unknown>
}

export interface DatapackWarning {
  type: string
  message: string
}

export interface DatapackError {
  type: string
  message: string
}

export interface DatapackContext {
  view: DatapackView
  selectedSus: number[]
  resolvedSuIds?: number[]
  color?: string
  isPartial?: boolean
}

export interface DatapackResponse<TData> {
  id: string
  version: string
  data: TData
  context: DatapackContext
  meta?: Record<string, unknown>
  warnings?: DatapackWarning[]
  errors?: DatapackError[]
}
