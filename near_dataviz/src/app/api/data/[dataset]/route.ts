import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getDpEmdvSatisfactionsByCategory } from '~/lib/datapacks/DpEmdvSatisfactionsByCategory'
import { getDpMobilityByZoneData } from '~/lib/datapacks/DpMobilityByZone'

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

      const payload = await getDpEmdvSatisfactionsByCategory(selectedSus, category)
      return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
    }
    
    // Point d'entrée pour les données de mobilité par zone
    if (decodedFilename === 'mobility-by-zone') {
      const { searchParams } = new URL(request.url)
      const susParam = searchParams.get('sus')
      const selectedSus = susParam && susParam.length > 0
        ? susParam.split(',').map(s => Number(s)).filter(n => !Number.isNaN(n))
        : undefined

      const payload = await getDpMobilityByZoneData({ selectedSus })
      return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
    }
    
    // Crée un filePath
    const filePath = path.join(process.cwd(), 'public', 'data', `${decodedFilename}.json`)
    
    // Read
    const fileContents = await fs.readFile(filePath, 'utf8')
    const data: unknown = JSON.parse(fileContents)
    
    // Return data with proper JSON response // Retourne les données avec une réponse JSON appropriée.
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=86400', // Cache de 24H, pas opti mais me permet de contourner le rafraichissement.
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



/** 
 * A merger :
  
 import type { NextRequest } from 'next/server'
 import { NextResponse } from 'next/server'
 import { getDpEmdvSatisfactionsByCategory } from '~/lib/datapacks/DpEmdvSatisfactionsByCategory'
 
 export async function GET(request: NextRequest) {
   try {
     const { searchParams } = new URL(request.url)
     const category = searchParams.get('category') ?? 'all'
     const susParam = searchParams.get('sus')
     const selectedSus = susParam && susParam.length > 0
       ? susParam.split(',').map(s => Number(s)).filter(n => !Number.isNaN(n))
       : undefined
 
     const payload = await getDpEmdvSatisfactionsByCategory(selectedSus, category)
     return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
   } catch (error) {
     console.error('[API] EMDV by-category error:', error)
     return NextResponse.json({ error: 'Failed to build EMDV payload' }, { status: 500 })
   }
 }
 
 */