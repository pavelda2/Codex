export type ProcessedRecipeImage = {
  id: string
  fullDataUrl: string
  thumbDataUrl: string
  mimeType: string
  width: number
  height: number
}

const FULL_MAX_SIDE = 1600
const THUMB_MAX_SIDE = 360
const WEBP_QUALITY = 0.8

export async function processRecipeImageFile(file: File): Promise<ProcessedRecipeImage> {
  const source = await loadImage(file)
  const full = resizeImage(source, FULL_MAX_SIDE)
  const thumb = resizeImage(source, THUMB_MAX_SIDE)

  return {
    id: createImageId(),
    fullDataUrl: full.dataUrl,
    thumbDataUrl: thumb.dataUrl,
    mimeType: 'image/webp',
    width: full.width,
    height: full.height,
  }
}

function createImageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const dataUrl = await readFileAsDataUrl(file)

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Nepodařilo se načíst obrázek.'))
    image.src = dataUrl
  })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Nepodařilo se načíst soubor obrázku.'))
        return
      }

      resolve(result)
    }
    reader.onerror = () => reject(new Error('Nepodařilo se načíst soubor obrázku.'))
    reader.readAsDataURL(file)
  })
}

function resizeImage(image: HTMLImageElement, maxSide: number): { dataUrl: string; width: number; height: number } {
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * ratio))
  const height = Math.max(1, Math.round(image.height * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Prohlížeč nepodporuje zpracování obrázků.')
  }

  context.drawImage(image, 0, 0, width, height)

  return {
    dataUrl: canvas.toDataURL('image/webp', WEBP_QUALITY),
    width,
    height,
  }
}
