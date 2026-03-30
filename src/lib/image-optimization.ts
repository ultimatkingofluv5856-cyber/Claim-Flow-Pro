interface OptimizeImageOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
}

function replaceExtension(filename: string, extension: string) {
  return filename.replace(/\.[^.]+$/, '') + `.${extension}`;
}

function fitWithin(width: number, height: number, maxDimension: number) {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  if (width >= height) {
    const ratio = maxDimension / width;
    return {
      width: maxDimension,
      height: Math.max(1, Math.round(height * ratio)),
    };
  }

  const ratio = maxDimension / height;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: maxDimension,
  };
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to process image ${file.name}.`));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

export async function optimizeImageUpload(file: File, options: OptimizeImageOptions = {}) {
  if (!file.type.startsWith('image/')) return file;

  const maxDimension = options.maxDimension ?? 2200;
  const quality = options.quality ?? 0.9;
  const mimeType = options.mimeType ?? 'image/jpeg';
  const image = await loadImage(file);
  const { width, height } = fitWithin(image.naturalWidth || image.width, image.naturalHeight || image.height, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) return file;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, mimeType, quality);
  if (!blob) return file;

  const extension = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const optimizedFile = new File([blob], replaceExtension(file.name, extension), {
    type: mimeType,
    lastModified: file.lastModified,
  });

  const resized = width < (image.naturalWidth || image.width) || height < (image.naturalHeight || image.height);
  if (!resized && optimizedFile.size >= file.size) {
    return file;
  }

  return optimizedFile;
}
