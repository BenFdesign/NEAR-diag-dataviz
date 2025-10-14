// Su Bank structure
export type SuBankData = {
  Id: number
  "Name Fr": string
  Icon1: string
  Icon2: string
  Ornement: string
  Background: string
  colorMain: string
  colorDark1: string
  colorDark2: string
  colorDark3: string
  colorDark4: string
  colorDark5: string
  colorLight1: string
  colorLight2: string
  colorLight3: string
  colorLight4: string
  colorLight5: string
  colorComp1: string
  colorComp2: string
  colorGraph1: string
  colorGraph2: string
  colorGraph3: string
  colorGraph4: string
  colorGraph5: string
  colorGraph6: string
  colorGraph7: string
  colorGraph8: string
  colorGraph9: string
  colorGraph10: string
  Position: string
  "Icon1 Link": string
  "Icon1 Source": string
  "Icon1 Attribution": string
  "Icon2 Link": string
  "Icon2 Source": string
  "Icon2 Attribution": string
  "Ornement Link": string
  "Ornement Source": string
  "Ornement Attribution": string
  "Background Bin": string
  "Background Filepath": string
  "Background Link": string
  "Background Source": string
}

// Su Data structure
export type SuData = {
  ID: number
  "Survey ID": number
  Su: number
  "Pop Percentage": string
  Barycenter: string
  "Created At": string
  "Updated At": string
  "Su Bank ID": number
}

// SuInfo structure
export type SuInfo = {
  id: number
  su: number
  name: string
  color: string
  popPercentage: number
  realPopulation: number
  icon: string
  bankData: SuBankData
}

// Board Registry structure
export type BoardDefinition = {
  id: string
  emoji: string
  name: string
  description: string
  component: React.ComponentType<BoardProps>
  requiredSus?: number[] // Permet de spécifier les SU pour des boards comparatifs
  defaultSus?: number[] // SU par défaut au chargement d'un board (finalement peu utilisé)
}

// Board Props
export type BoardProps = {
  selectedSus: number[]
  allSus: SuInfo[]
}

// Menu State
export type MenuState = {
  selectedBoard: string
  selectedSus: number[]
  availableSus: SuInfo[]
}

// Board interface for new board system
export interface Board {
  id: string
  name: string
  emoji: string
  description: string
  renderComponent: (props: {
    selectedSus?: number[]
    // Removed containerWidth/containerHeight - Board manages its own dimensions
  }) => React.ReactElement
}

// Data cache type for client-side caching
export type DataCache = {
  suBankData?: SuBankData[]
  suData?: SuData[]
  surveys?: Array<{ ID?: number, Name?: string }>
  quartiers?: Array<{ "Population Sum"?: number, "Survey ID"?: number }>
  wayOfLifeData?: unknown[]
  carbonFootprintData?: unknown[]
  metaEmdvQuestions?: unknown[]
  metaEmdvChoices?: unknown[]
  [key: string]: unknown
}