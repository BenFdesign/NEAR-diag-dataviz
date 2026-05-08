import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getDpEmdvSatisfactionsByCategoryDatapack } from '~/lib/datapacks/DpEmdvSatisfactionsByCategory'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dataset: string }> }
) {
  try {
    const { dataset } = await params
    
    // Decode du fichier avec un nom URL-encoded
    const decodedFilename = decodeURIComponent(dataset)
    
    // Point d'entrée unifié: si le dataset demandé est "emdv-by-category",
    // on retourne le payload calculé via le datapack, sinon on lit le JSON du dossier public/data
    if (decodedFilename === 'emdv-by-category') {
      const { searchParams } = new URL(request.url)
      const category = searchParams.get('category') ?? 'all'
      const susParam = searchParams.get('sus')
      const selectedSus = susParam && susParam.length > 0
        ? susParam.split(',').map(s => Number(s)).filter(n => !Number.isNaN(n))
        : undefined

      const response = await getDpEmdvSatisfactionsByCategoryDatapack({ selectedSus, extra: { subcategory: category } })
      return NextResponse.json(response.data, { headers: { 'Cache-Control': 'no-store' } })
    }
    
  
    // Crée un filePath
    const filePath = path.join(process.cwd(), 'public', 'data', `${decodedFilename}.json`)
    
    // Read
    const fileContents = await fs.readFile(filePath, 'utf8')
    let data: unknown = JSON.parse(fileContents)

    // Filtre par surveyId si fourni en query param (?surveyId=1)
    // Supporte les deux conventions de nommage: "Survey ID" (espace) et "SurveyId" (camelCase)
    const { searchParams } = new URL(request.url)
    const surveyIdParam = searchParams.get('surveyId')
    if (surveyIdParam !== null && Array.isArray(data)) {
      const surveyId = Number(surveyIdParam)
      data = data.filter((row: unknown) => {
        if (typeof row !== 'object' || row === null) return false
        const r = row as Record<string, unknown>
        const hasSpaceKey = Object.prototype.hasOwnProperty.call(r, 'Survey ID')
        const hasCamelKey = Object.prototype.hasOwnProperty.call(r, 'SurveyId')
        if (!hasSpaceKey && !hasCamelKey) return true // ligne sans champ survey (métadonnée) : passthrough
        return r['Survey ID'] === surveyId || r.SurveyId === surveyId
      })
    }

    // Return data with proper JSON response // Retourne les données avec une réponse JSON appropriée.
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=86400', // Cache 24H — l'URL inclut ?surveyId donc les entrées sont naturellement isolées par survey
      },
    })
  } catch (error) {
    console.error('Error loading dataset:', error)
    return NextResponse.json(
      { error: 'Failed to load dataset' },
      { status: 500 }
    )
  }
}
