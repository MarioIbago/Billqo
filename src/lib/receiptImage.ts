const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 5.5 * 1024 * 1024;
const MAX_DIMENSION = 2000;

interface DrawableImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

async function loadWithImageBitmap(file: File): Promise<DrawableImage | undefined> {
  if (typeof createImageBitmap !== 'function') return undefined;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  } catch {
    return undefined;
  }
}

async function loadWithImageElement(file: File): Promise<DrawableImage> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      image.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('IMAGE_ENCODE_FAILED'));
    }, 'image/jpeg', quality);
  });
}

export async function prepareReceiptImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona una fotografía del comprobante.');
  if (file.size <= 0) throw new Error('La imagen está vacía.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('La imagen es demasiado grande. Intenta tomar otra foto.');

  const drawable = await loadWithImageBitmap(file) ?? await loadWithImageElement(file).catch(() => undefined);
  if (!drawable || drawable.width <= 0 || drawable.height <= 0) {
    throw new Error('No pudimos preparar esta imagen. Intenta tomar otra foto.');
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(drawable.width, drawable.height));
    const width = Math.max(1, Math.round(drawable.width * scale));
    const height = Math.max(1, Math.round(drawable.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('IMAGE_CANVAS_UNAVAILABLE');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(drawable.source, 0, 0, width, height);

    let output = await canvasBlob(canvas, 0.82);
    if (output.size > MAX_OUTPUT_BYTES) output = await canvasBlob(canvas, 0.68);
    if (output.size > MAX_OUTPUT_BYTES) throw new Error('La imagen sigue siendo demasiado grande. Intenta tomar otra foto.');
    return output;
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith('IMAGE_')) throw error;
    throw new Error('No pudimos preparar esta imagen. Intenta tomar otra foto.');
  } finally {
    drawable.cleanup();
  }
}
