import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dataset: string }> }
) {
  try {
    const { dataset } = await params
    
    // Decode du fichier avec un nom URL-encoded
    const decodedFilename = decodeURIComponent(dataset)
    
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