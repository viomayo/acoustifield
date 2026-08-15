export const MAX_PHOTO_DIMENSION = 1280
export const PHOTO_JPEG_QUALITY = 0.8

export async function resizeImageToJpeg(
  file: File,
  maxDimension = MAX_PHOTO_DIMENSION,
  quality = PHOTO_JPEG_QUALITY,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas indisponible')
    context.drawImage(bitmap, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Encodage JPEG impossible'))
      }, 'image/jpeg', quality)
    })
  } finally {
    bitmap.close()
  }
}
