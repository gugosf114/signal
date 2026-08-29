const CARD_ASPECT = 0.716;
const DETECT_EDGE = 240;

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function centeredCardBounds(width, height) {
  const usableWidth = width * 0.96;
  const usableHeight = height * 0.96;
  let cropWidth = usableWidth;
  let cropHeight = cropWidth / CARD_ASPECT;
  if (cropHeight > usableHeight) {
    cropHeight = usableHeight;
    cropWidth = cropHeight * CARD_ASPECT;
  }
  return {
    x: Math.max(0, (width - cropWidth) / 2),
    y: Math.max(0, (height - cropHeight) * 0.54),
    width: cropWidth,
    height: cropHeight,
  };
}

function integral(values, width, height) {
  const stride = width + 1;
  const result = new Int32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += values[y * width + x];
      result[(y + 1) * stride + x + 1] = result[y * stride + x + 1] + row;
    }
  }
  return result;
}

function sumRect(table, width, height, x0, y0, x1, y1) {
  const stride = width + 1;
  const left = clamp(Math.floor(x0), 0, width);
  const top = clamp(Math.floor(y0), 0, height);
  const right = clamp(Math.ceil(x1), 0, width);
  const bottom = clamp(Math.ceil(y1), 0, height);
  return table[bottom * stride + right]
    - table[top * stride + right]
    - table[bottom * stride + left]
    + table[top * stride + left];
}

// Finds the largest strong portrait rectangle. Trading cards share almost the
// same 0.716 width/height ratio, so keyboard rows and desk edges cannot win on
// edge strength alone unless they also form a card-shaped box.
export function detectCardBoundsFromGray(gray, width, height) {
  if (!gray || gray.length < width * height || width < 24 || height < 24) {
    return centeredCardBounds(width, height);
  }

  const dx = new Uint16Array(width * height);
  const dy = new Uint16Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      dx[index] = Math.abs(gray[index + 1] - gray[index - 1]);
      dy[index] = Math.abs(gray[index + width] - gray[index - width]);
    }
  }

  const ix = integral(dx, width, height);
  const iy = integral(dy, width, height);
  const band = 2;
  const vertical = (x, y, edgeHeight) => {
    if (x <= 1 || x >= width - 2) return 20 * edgeHeight * (band * 2 + 1);
    return sumRect(ix, width, height, x - band, y, x + band + 1, y + edgeHeight);
  };
  const horizontal = (x, y, edgeWidth) => {
    if (y <= 1 || y >= height - 2) return 20 * edgeWidth * (band * 2 + 1);
    return sumRect(iy, width, height, x, y - band, x + edgeWidth, y + band + 1);
  };

  const maxHeight = Math.min(Math.floor(height * 0.96), Math.floor((width - 2) / CARD_ASPECT));
  const minHeight = Math.max(24, Math.floor(maxHeight * 0.55));
  if (maxHeight < minHeight) return centeredCardBounds(width, height);

  let best = null;
  const step = Math.max(2, Math.floor(maxHeight / 70));
  for (let candidateHeight = minHeight; candidateHeight <= maxHeight; candidateHeight += step) {
    const candidateWidth = Math.round(candidateHeight * CARD_ASPECT);
    for (let y = 0; y <= height - candidateHeight; y += step) {
      for (let x = 0; x <= width - candidateWidth; x += step) {
        const verticalScore = (
          vertical(x, y, candidateHeight)
          + vertical(x + candidateWidth - 1, y, candidateHeight)
        ) / (2 * candidateHeight * (band * 2 + 1));
        const horizontalScore = (
          horizontal(x, y, candidateWidth)
          + horizontal(x, y + candidateHeight - 1, candidateWidth)
        ) / (2 * candidateWidth * (band * 2 + 1));
        const score = verticalScore + horizontalScore + 8 * (candidateHeight / maxHeight);
        if (!best || score > best.score) {
          best = { x, y, width: candidateWidth, height: candidateHeight, score };
        }
      }
    }
  }

  if (!best || best.score < 24) return centeredCardBounds(width, height);

  const chooseEdge = (positions, strength, side) => {
    const scored = positions.map((position) => ({ position, value: strength(position) }));
    const peak = Math.max(...scored.map((item) => item.value), 1);
    const strong = scored.filter((item) => item.value >= peak * 0.72);
    return side === 'start' ? strong[0].position : strong[strong.length - 1].position;
  };
  const edgeRange = (center, radius, limit) => {
    const start = clamp(Math.floor(center - radius), 0, limit - 1);
    const end = clamp(Math.ceil(center + radius), 0, limit - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  };

  const rightGuess = best.x + best.width - 1;
  const bottomGuess = best.y + best.height - 1;
  const xRadius = Math.max(3, best.width * 0.12);
  const yRadius = Math.max(3, best.height * 0.12);
  const top = chooseEdge(
    edgeRange(best.y, yRadius, height),
    (position) => horizontal(best.x, position, best.width),
    'start',
  );
  const bottom = chooseEdge(
    edgeRange(bottomGuess, yRadius, height),
    (position) => horizontal(best.x, position, best.width),
    'end',
  );
  const left = best.x <= 2 ? 0 : chooseEdge(
    edgeRange(best.x, xRadius, width),
    (position) => vertical(position, best.y, best.height),
    'start',
  );
  const right = rightGuess >= width - 3 ? width - 1 : chooseEdge(
    edgeRange(rightGuess, xRadius, width),
    (position) => vertical(position, best.y, best.height),
    'end',
  );

  const padX = Math.max(1, Math.round((right - left + 1) * 0.01));
  const padY = Math.max(1, Math.round((bottom - top + 1) * 0.01));
  const x = clamp(left - padX, 0, width - 1);
  const y = clamp(top - padY, 0, height - 1);
  const x2 = clamp(right + padX + 1, x + 1, width);
  const y2 = clamp(bottom + padY + 1, y + 1, height);
  return { x, y, width: x2 - x, height: y2 - y };
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch {}
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('The uploaded card photo could not be read.')); };
    image.src = url;
  });
}

function canvasFile(canvas, name) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The uploaded card photo could not be cropped.'));
        return;
      }
      resolve(new File([blob], name || 'card-crop.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  });
}

export async function cropUploadedCardFile(file) {
  const image = await decode(file);
  const sourceWidth = image.width || image.naturalWidth;
  const sourceHeight = image.height || image.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error('The uploaded card photo was empty.');

  const scale = Math.min(1, DETECT_EDGE / Math.max(sourceWidth, sourceHeight));
  const detect = document.createElement('canvas');
  detect.width = Math.max(24, Math.round(sourceWidth * scale));
  detect.height = Math.max(24, Math.round(sourceHeight * scale));
  const detectContext = detect.getContext('2d', { willReadFrequently: true });
  detectContext.drawImage(image, 0, 0, detect.width, detect.height);
  const rgba = detectContext.getImageData(0, 0, detect.width, detect.height).data;
  const gray = new Uint8Array(detect.width * detect.height);
  for (let index = 0, pixel = 0; index < rgba.length; index += 4, pixel++) {
    gray[pixel] = Math.round(rgba[index] * 0.299 + rgba[index + 1] * 0.587 + rgba[index + 2] * 0.114);
  }

  const found = detectCardBoundsFromGray(gray, detect.width, detect.height);
  const crop = {
    x: clamp(Math.round(found.x / scale), 0, sourceWidth - 1),
    y: clamp(Math.round(found.y / scale), 0, sourceHeight - 1),
    width: clamp(Math.round(found.width / scale), 1, sourceWidth),
    height: clamp(Math.round(found.height / scale), 1, sourceHeight),
  };
  crop.width = Math.min(crop.width, sourceWidth - crop.x);
  crop.height = Math.min(crop.height, sourceHeight - crop.y);

  const output = document.createElement('canvas');
  output.width = crop.width;
  output.height = crop.height;
  output.getContext('2d').drawImage(
    image,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, output.width, output.height,
  );
  image.close?.();
  return canvasFile(output, `card-crop-${file?.name || 'upload.jpg'}`);
}

