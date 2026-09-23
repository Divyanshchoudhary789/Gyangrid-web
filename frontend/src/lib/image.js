import { DOUBT_LIMITS } from '@/config/constants';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];

export function validateImageFile(file) {
  if (!file) return 'Please choose an image.';
  if (!ACCEPTED.includes(file.type) && !/\.(heic|heif)$/i.test(file.name)) return 'Please upload a JPG, PNG or HEIC photo.';
  if (file.size > DOUBT_LIMITS.maxImageMb * 1024 * 1024) return `Photo must be under ${DOUBT_LIMITS.maxImageMb} MB.`;
  return null;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image. Try a JPG or PNG photo.'));
    img.src = src;
  });
}

/**
 * Crop (fractional rect), rotate (multiples of 90°) and downscale to the long-edge limit,
 * then JPEG-compress. Returns { blob, dataUrl, width, height, sizeKb }.
 */
export async function processImage(src, {
  rotation = 0, crop = null, maxEdge = DOUBT_LIMITS.imageLongEdgePx, quality = 0.82,
} = {}) {
  const img = await loadImage(src);
  const c = crop || { x: 0, y: 0, w: 1, h: 1 };
  const sx = Math.round(c.x * img.naturalWidth);
  const sy = Math.round(c.y * img.naturalHeight);
  const sw = Math.max(1, Math.round(c.w * img.naturalWidth));
  const sh = Math.max(1, Math.round(c.h * img.naturalHeight));

  const quarterTurn = rotation % 180 !== 0;
  const baseW = quarterTurn ? sh : sw;
  const baseH = quarterTurn ? sw : sh;
  const scale = Math.min(1, maxEdge / Math.max(baseW, baseH));
  const outW = Math.round(baseW * scale);
  const outH = Math.round(baseH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  const dw = quarterTurn ? outH : outW;
  const dh = quarterTurn ? outW : outH;
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  return {
    blob,
    dataUrl: canvas.toDataURL('image/jpeg', quality),
    width: outW,
    height: outH,
    sizeKb: blob ? Math.round(blob.size / 1024) : 0,
  };
}

export const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read the file.'));
  reader.readAsDataURL(file);
});
