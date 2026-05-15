"use client";

import { applyBanubaBeautyFilter } from "@/lib/client-banuba-beauty";

export type BeautyStrength = 0 | 1 | 2 | 3 | 4;

export const BEAUTY_OPTIONS: Array<{
  value: BeautyStrength;
  label: string;
  caption: string;
}> = [
  { value: 0, label: "0단계", caption: "원본" },
  { value: 1, label: "1단계", caption: "자연" },
  { value: 2, label: "2단계", caption: "기본" },
  { value: 3, label: "3단계", caption: "화사" },
  { value: 4, label: "4단계", caption: "강함" },
];

interface Landmark {
  x: number;
  y: number;
  z?: number;
}

interface FaceMeshResults {
  multiFaceLandmarks?: Landmark[][];
}

interface FaceMeshInstance {
  setOptions: (options: {
    maxNumFaces: number;
    refineLandmarks: boolean;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }) => void;
  onResults: (callback: (results: FaceMeshResults) => void) => void;
  send: (input: { image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement }) => Promise<void>;
}

type FaceMeshConstructor = new (config: { locateFile: (file: string) => string }) => FaceMeshInstance;

interface FaceBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

interface FaceMaskData {
  faceMask: Uint8ClampedArray;
  protectedMask: Uint8ClampedArray;
  boxes: FaceBox[];
}

const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176,
  149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];
const LEFT_EYE = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
const RIGHT_EYE = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249];
const OUTER_LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const LEFT_BROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const RIGHT_BROW = [336, 296, 334, 293, 300, 285, 295, 282, 283, 276];

const BEAUTY_SETTINGS: Record<
  BeautyStrength,
  {
    blurRadius: number;
    smoothBlend: number;
    brightness: number;
    contrast: number;
    saturation: number;
    warmth: number;
    contour: number;
  }
> = {
  0: { blurRadius: 0, smoothBlend: 0, brightness: 0, contrast: 1, saturation: 1, warmth: 0, contour: 0 },
  1: { blurRadius: 1.4, smoothBlend: 0.16, brightness: 2, contrast: 1.015, saturation: 1.01, warmth: 1.2, contour: 0.008 },
  2: { blurRadius: 2.4, smoothBlend: 0.28, brightness: 5, contrast: 1.03, saturation: 1.03, warmth: 2.5, contour: 0.016 },
  3: { blurRadius: 3.4, smoothBlend: 0.4, brightness: 8, contrast: 1.045, saturation: 1.05, warmth: 3.6, contour: 0.025 },
  4: { blurRadius: 4.4, smoothBlend: 0.52, brightness: 11, contrast: 1.06, saturation: 1.065, warmth: 4.5, contour: 0.035 },
};

let faceMeshPromise: Promise<FaceMeshInstance> | null = null;
let faceMeshQueue: Promise<Landmark[][]> = Promise.resolve([]);

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다"));
    image.src = dataUrl;
  });
}

async function getFaceMesh(): Promise<FaceMeshInstance> {
  if (!faceMeshPromise) {
    faceMeshPromise = import("@mediapipe/face_mesh").then((module) => {
      const FaceMesh = (module as unknown as { FaceMesh: FaceMeshConstructor }).FaceMesh;
      const mesh = new FaceMesh({
        locateFile: (file) => `/vendor/mediapipe/face_mesh/${file}`,
      });
      mesh.setOptions({
        maxNumFaces: 6,
        refineLandmarks: false,
        minDetectionConfidence: 0.45,
        minTrackingConfidence: 0.45,
      });
      return mesh;
    });
  }

  return faceMeshPromise;
}

function detectFaces(image: HTMLImageElement): Promise<Landmark[][]> {
  const task = faceMeshQueue
    .catch(() => [])
    .then(() => detectFacesNow(image));
  faceMeshQueue = task.catch(() => []);
  return task;
}

async function detectFacesNow(image: HTMLImageElement): Promise<Landmark[][]> {
  const mesh = await getFaceMesh();

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      settled = true;
      resolve([]);
    }, 6000);

    mesh.onResults((results) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      resolve((results.multiFaceLandmarks ?? []).slice(0, 6));
    });

    mesh.send({ image }).catch((error) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      reject(error);
    });
  });
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clampUnit((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function skinMask(red: number, green: number, blue: number): number {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const chroma = max - min;
  const brightness = (red + green + blue) / 3;
  const sum = Math.max(1, red + green + blue);
  const normalizedRed = red / sum;
  const normalizedGreen = green / sum;

  if (brightness < 42 || brightness > 246) {
    return 0;
  }

  const warmSkin =
    red > 58 &&
    green > 35 &&
    blue > 24 &&
    red >= green * 0.96 &&
    red > blue &&
    normalizedRed > 0.34 &&
    normalizedGreen > 0.26 &&
    chroma > 8;
  const brightSkin = red > 92 && green > 64 && blue > 48 && red >= blue && chroma < 105;

  if (!warmSkin && !brightSkin) {
    return 0;
  }

  return clampUnit(0.35 + (brightness - 42) / 210);
}

function landmarkPoint(face: Landmark[], index: number, width: number, height: number): { x: number; y: number } | null {
  const point = face[index];
  if (!point) {
    return null;
  }

  return {
    x: point.x * width,
    y: point.y * height,
  };
}

function drawPolygon(
  context: CanvasRenderingContext2D,
  face: Landmark[],
  indices: number[],
  width: number,
  height: number,
) {
  const points = indices
    .map((index) => landmarkPoint(face, index, width, height))
    .filter((point): point is { x: number; y: number } => Boolean(point));
  if (points.length < 3) {
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.closePath();
  context.fill();
}

function drawFeatureStroke(
  context: CanvasRenderingContext2D,
  face: Landmark[],
  indices: number[],
  width: number,
  height: number,
  lineWidth: number,
) {
  const points = indices
    .map((index) => landmarkPoint(face, index, width, height))
    .filter((point): point is { x: number; y: number } => Boolean(point));
  if (points.length < 2) {
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();
}

function rasterizeMask(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void, blur = 0): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return new Uint8ClampedArray(width * height);
  }

  context.fillStyle = "#fff";
  context.strokeStyle = "#fff";
  draw(context);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputContext = outputCanvas.getContext("2d", { willReadFrequently: true });
  if (!outputContext) {
    return new Uint8ClampedArray(width * height);
  }

  if (blur > 0) {
    outputContext.filter = `blur(${blur}px)`;
  }
  outputContext.drawImage(canvas, 0, 0);
  outputContext.filter = "none";

  const alpha = outputContext.getImageData(0, 0, width, height).data;
  const mask = new Uint8ClampedArray(width * height);
  for (let index = 0, pixel = 0; index < alpha.length; index += 4, pixel += 1) {
    mask[pixel] = alpha[index + 3];
  }
  return mask;
}

function faceBox(face: Landmark[], width: number, height: number): FaceBox | null {
  const points = FACE_OVAL
    .map((index) => landmarkPoint(face, index, width, height))
    .filter((point): point is { x: number; y: number } => Boolean(point));
  if (points.length < 8) {
    return null;
  }

  const minX = Math.max(0, Math.min(...points.map((point) => point.x)));
  const minY = Math.max(0, Math.min(...points.map((point) => point.y)));
  const maxX = Math.min(width - 1, Math.max(...points.map((point) => point.x)));
  const maxY = Math.min(height - 1, Math.max(...points.map((point) => point.y)));
  if (maxX <= minX || maxY <= minY) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function buildFaceMasks(faces: Landmark[][], width: number, height: number): FaceMaskData | null {
  const faceEntries = faces
    .map((face) => ({ face, box: faceBox(face, width, height) }))
    .filter((entry): entry is { face: Landmark[]; box: FaceBox } => Boolean(entry.box));
  if (faceEntries.length === 0) {
    return null;
  }
  const boxes = faceEntries.map((entry) => entry.box);

  const faceMask = rasterizeMask(
    width,
    height,
    (context) => {
      faceEntries.forEach(({ face }) => drawPolygon(context, face, FACE_OVAL, width, height));
    },
    3,
  );
  const protectedMask = rasterizeMask(
    width,
    height,
    (context) => {
      faceEntries.forEach(({ face, box }) => {
        const lineWidth = Math.max(8, box.maxX - box.minX) * 0.045;
        drawPolygon(context, face, LEFT_EYE, width, height);
        drawPolygon(context, face, RIGHT_EYE, width, height);
        drawPolygon(context, face, OUTER_LIPS, width, height);
        drawFeatureStroke(context, face, LEFT_BROW, width, height, lineWidth);
        drawFeatureStroke(context, face, RIGHT_BROW, width, height, lineWidth);
      });
    },
    2,
  );

  return { faceMask, protectedMask, boxes };
}

function sampleBilinear(source: Uint8ClampedArray, width: number, height: number, x: number, y: number, channel: number): number {
  const safeX = Math.max(0, Math.min(width - 1, x));
  const safeY = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(safeX);
  const y0 = Math.floor(safeY);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const dx = safeX - x0;
  const dy = safeY - y0;
  const i00 = (y0 * width + x0) * 4 + channel;
  const i10 = (y0 * width + x1) * 4 + channel;
  const i01 = (y1 * width + x0) * 4 + channel;
  const i11 = (y1 * width + x1) * 4 + channel;
  const top = source[i00] * (1 - dx) + source[i10] * dx;
  const bottom = source[i01] * (1 - dx) + source[i11] * dx;
  return top * (1 - dy) + bottom * dy;
}

function applyContourWarp(source: ImageData, maskData: FaceMaskData, strength: BeautyStrength): ImageData {
  const settings = BEAUTY_SETTINGS[strength];
  if (settings.contour <= 0) {
    return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  }

  const width = source.width;
  const height = source.height;
  const input = source.data;
  const output = new Uint8ClampedArray(input);

  maskData.boxes.forEach((box) => {
    const faceWidth = Math.max(1, box.maxX - box.minX);
    const faceHeight = Math.max(1, box.maxY - box.minY);
    const startX = Math.max(0, Math.floor(box.minX - faceWidth * 0.05));
    const endX = Math.min(width - 1, Math.ceil(box.maxX + faceWidth * 0.05));
    const startY = Math.max(0, Math.floor(box.minY));
    const endY = Math.min(height - 1, Math.ceil(box.maxY));

    for (let y = startY; y <= endY; y += 1) {
      const normalizedY = (y - box.minY) / faceHeight;
      const lowerFaceWeight = smoothstep(0.26, 0.86, normalizedY) * (1 - smoothstep(0.95, 1.05, normalizedY));
      if (lowerFaceWeight <= 0) {
        continue;
      }

      for (let x = startX; x <= endX; x += 1) {
        const pixel = y * width + x;
        const maskWeight = (maskData.faceMask[pixel] / 255) * (1 - maskData.protectedMask[pixel] / 255);
        if (maskWeight <= 0.01) {
          continue;
        }

        const normalizedX = (x - box.centerX) / (faceWidth / 2);
        const sideWeight = smoothstep(0.22, 0.98, Math.abs(normalizedX));
        const warpWeight = settings.contour * maskWeight * lowerFaceWeight * sideWeight;
        if (warpWeight <= 0.0005) {
          continue;
        }

        const scale = Math.max(0.88, 1 - warpWeight);
        const sourceX = box.centerX + (x - box.centerX) / scale;
        const offset = pixel * 4;
        output[offset] = clamp(sampleBilinear(input, width, height, sourceX, y, 0));
        output[offset + 1] = clamp(sampleBilinear(input, width, height, sourceX, y, 1));
        output[offset + 2] = clamp(sampleBilinear(input, width, height, sourceX, y, 2));
        output[offset + 3] = clamp(sampleBilinear(input, width, height, sourceX, y, 3));
      }
    }
  });

  return new ImageData(output, width, height);
}

function hasFaceMask(mask: Uint8ClampedArray): boolean {
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] > 0) {
      return true;
    }
  }
  return false;
}

export async function applyBeautyFilter(dataUrl: string, strength: BeautyStrength): Promise<string> {
  if (strength === 0) {
    return dataUrl;
  }

  const banubaResult = await applyBanubaBeautyFilter(dataUrl, strength);
  if (banubaResult) {
    return banubaResult;
  }

  try {
    const image = await loadImage(dataUrl);
    const faces = await detectFaces(image);
    if (faces.length === 0) {
      return dataUrl;
    }

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return dataUrl;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const source = context.getImageData(0, 0, canvas.width, canvas.height);
    const maskData = buildFaceMasks(faces, canvas.width, canvas.height);
    if (!maskData || !hasFaceMask(maskData.faceMask)) {
      return dataUrl;
    }

    const contoured = applyContourWarp(source, maskData, strength);
    context.putImageData(contoured, 0, 0);

    const blurCanvas = document.createElement("canvas");
    blurCanvas.width = canvas.width;
    blurCanvas.height = canvas.height;
    const blurContext = blurCanvas.getContext("2d", { willReadFrequently: true });
    if (!blurContext) {
      return dataUrl;
    }

    const settings = BEAUTY_SETTINGS[strength];
    blurContext.filter = `blur(${settings.blurRadius}px)`;
    blurContext.drawImage(canvas, 0, 0);
    blurContext.filter = "none";

    const working = context.getImageData(0, 0, canvas.width, canvas.height);
    const blurred = blurContext.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = working.data;
    const blurPixels = blurred.data;

    for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
      const alpha = pixels[index + 3];
      if (alpha === 0) {
        continue;
      }

      const faceWeight = (maskData.faceMask[pixel] / 255) * (1 - maskData.protectedMask[pixel] / 255);
      if (faceWeight <= 0.01) {
        continue;
      }

      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const skinWeight = skinMask(red, green, blue);
      if (skinWeight <= 0) {
        continue;
      }

      const toneWeight = faceWeight * skinWeight;
      const smoothBlend = toneWeight * settings.smoothBlend;
      const smoothedRed = red * (1 - smoothBlend) + blurPixels[index] * smoothBlend;
      const smoothedGreen = green * (1 - smoothBlend) + blurPixels[index + 1] * smoothBlend;
      const smoothedBlue = blue * (1 - smoothBlend) + blurPixels[index + 2] * smoothBlend;
      const average = (smoothedRed + smoothedGreen + smoothedBlue) / 3;
      const adjustedRed =
        (average + (smoothedRed - average) * settings.saturation - 128) * settings.contrast +
        128 +
        settings.brightness +
        settings.warmth;
      const adjustedGreen =
        (average + (smoothedGreen - average) * settings.saturation - 128) * settings.contrast +
        128 +
        settings.brightness;
      const adjustedBlue =
        (average + (smoothedBlue - average) * settings.saturation - 128) * settings.contrast +
        128 +
        settings.brightness -
        settings.warmth * 0.5;

      pixels[index] = clamp(smoothedRed * (1 - toneWeight) + adjustedRed * toneWeight);
      pixels[index + 1] = clamp(smoothedGreen * (1 - toneWeight) + adjustedGreen * toneWeight);
      pixels[index + 2] = clamp(smoothedBlue * (1 - toneWeight) + adjustedBlue * toneWeight);
    }

    context.putImageData(working, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}
