"use client";

type SegmentationResult = {
  segmentationMask: CanvasImageSource;
};

type SelfieSegmenter = {
  setOptions: (options: { modelSelection: number; selfieMode: boolean }) => void;
  onResults: (callback: (results: SegmentationResult) => void) => void;
  send: (input: { image: HTMLCanvasElement }) => Promise<void>;
  close: () => void;
};

interface ChromaKeyResult {
  dataUrl: string;
  transparentRatio: number;
  edgeGreenRatio: number;
}

interface PixelMetrics {
  hue: number;
  saturation: number;
  value: number;
  greenDominance: number;
}

interface ChromaKeyProfile {
  red: number;
  green: number;
  blue: number;
  hue: number;
  sampleRatio: number;
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = dataUrl;
  });
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

function createSourceCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const sourceContext = canvas.getContext("2d");
  if (!sourceContext) {
    throw new Error("Failed to prepare foreground canvas.");
  }
  sourceContext.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function getPixelMetrics(red: number, green: number, blue: number): PixelMetrics {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;
  const greenDominance = green - Math.max(red, blue);
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  return {
    hue,
    saturation,
    value: max,
    greenDominance,
  };
}

function hueDistance(a: number, b: number): number {
  const distance = Math.abs(a - b);
  return Math.min(distance, 360 - distance);
}

function isGreenScreenPixel(red: number, green: number, blue: number): boolean {
  const metrics = getPixelMetrics(red, green, blue);
  return (
    green > 48 &&
    metrics.saturation > 0.1 &&
    metrics.greenDominance > 7 &&
    metrics.hue >= 70 &&
    metrics.hue <= 185 &&
    green > red * 1.03 &&
    green > blue * 1.02
  );
}

function sampleChromaKeyProfile(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  marginX: number,
  marginY: number,
): ChromaKeyProfile | undefined {
  let edgePixels = 0;
  let samples = 0;
  let redSum = 0;
  let greenSum = 0;
  let blueSum = 0;
  let hueSinSum = 0;
  let hueCosSum = 0;
  const step = Math.max(1, Math.round(Math.min(width, height) / 260));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (!(x < marginX || x >= width - marginX || y < marginY || y >= height - marginY)) {
        continue;
      }

      edgePixels += 1;
      const index = (y * width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];

      if (!isGreenScreenPixel(red, green, blue)) {
        continue;
      }

      const { hue } = getPixelMetrics(red, green, blue);
      const hueRadians = (hue * Math.PI) / 180;
      samples += 1;
      redSum += red;
      greenSum += green;
      blueSum += blue;
      hueSinSum += Math.sin(hueRadians);
      hueCosSum += Math.cos(hueRadians);
    }
  }

  if (edgePixels === 0 || samples / edgePixels < 0.025) {
    return undefined;
  }

  let hue = (Math.atan2(hueSinSum / samples, hueCosSum / samples) * 180) / Math.PI;
  if (hue < 0) {
    hue += 360;
  }

  return {
    red: redSum / samples,
    green: greenSum / samples,
    blue: blueSum / samples,
    hue,
    sampleRatio: samples / edgePixels,
  };
}

function removeChromaKey(canvas: HTMLCanvasElement): ChromaKeyResult {
  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  const context = output.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Failed to create chroma key output.");
  }

  context.drawImage(canvas, 0, 0, output.width, output.height);
  const imageData = context.getImageData(0, 0, output.width, output.height);
  const { data } = imageData;
  const marginX = Math.max(12, Math.round(output.width * 0.06));
  const marginY = Math.max(12, Math.round(output.height * 0.06));
  const profile = sampleChromaKeyProfile(data, output.width, output.height, marginX, marginY);
  let transparentPixels = 0;
  let edgePixels = 0;
  let edgeGreenPixels = 0;

  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      const index = (y * output.width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const alpha = data[index + 3];
      const metrics = getPixelMetrics(red, green, blue);
      const greenScore =
        smoothstep(5, 62, metrics.greenDominance) *
        smoothstep(0.08, 0.34, metrics.saturation) *
        smoothstep(55, 145, green);
      const profileHueScore = profile ? 1 - smoothstep(10, 58, hueDistance(metrics.hue, profile.hue)) : 0;
      const profileDistance = profile
        ? Math.sqrt((red - profile.red) ** 2 + (green - profile.green) ** 2 + (blue - profile.blue) ** 2)
        : Number.POSITIVE_INFINITY;
      const profileColorScore = profile ? 1 - smoothstep(36, 132, profileDistance) : 0;
      const profileScore =
        Math.max(profileHueScore * smoothstep(0.08, 0.24, metrics.saturation), profileColorScore) *
        smoothstep(3, 32, metrics.greenDominance);
      const screenLike =
        isGreenScreenPixel(red, green, blue) ||
        Boolean(profile && profileHueScore > 0.42 && metrics.saturation > 0.08 && metrics.greenDominance > 4);
      const keyStrength = screenLike ? Math.max(greenScore, profileScore) : 0;
      let nextAlpha = alpha;

      if (
        keyStrength > 0.5 ||
        (screenLike && metrics.greenDominance > 16 && metrics.saturation > 0.13) ||
        (profile && profileHueScore > 0.72 && metrics.greenDominance > 8 && metrics.saturation > 0.12)
      ) {
        nextAlpha = 0;
      } else if (keyStrength > 0.14) {
        const removeAmount = smoothstep(0.12, 0.5, keyStrength);
        nextAlpha = clamp(Math.round(alpha * (1 - removeAmount)));
      }

      if (nextAlpha <= 16) {
        transparentPixels += 1;
      }

      data[index + 3] = nextAlpha <= 16 ? 0 : nextAlpha;

      if (nextAlpha > 0 && metrics.greenDominance > 0) {
        const spill =
          smoothstep(2, 48, metrics.greenDominance) *
          smoothstep(0.08, 0.34, metrics.saturation) *
          (nextAlpha / 255);
        data[index + 1] = clamp(Math.round(green - metrics.greenDominance * 0.78 * spill));
      }

      if (x < marginX || x >= output.width - marginX || y < marginY || y >= output.height - marginY) {
        edgePixels += 1;
        if (screenLike) {
          edgeGreenPixels += 1;
        }
      }
    }
  }

  context.putImageData(imageData, 0, 0);
  return {
    dataUrl: output.toDataURL("image/png"),
    transparentRatio: transparentPixels / (output.width * output.height),
    edgeGreenRatio: edgePixels === 0 ? 0 : edgeGreenPixels / edgePixels,
  };
}

function isUsableChromaKey(result: ChromaKeyResult): boolean {
  return result.edgeGreenRatio > 0.08 && result.transparentRatio > 0.08 && result.transparentRatio < 0.95;
}

async function removeWithMediaPipe(canvas: HTMLCanvasElement): Promise<string> {
  let segmenter: SelfieSegmenter | undefined;
  try {
    const { SelfieSegmentation } = await import("@mediapipe/selfie_segmentation");
    const activeSegmenter = new SelfieSegmentation({
      locateFile: (file: string) => `/vendor/mediapipe/selfie_segmentation/${file}`,
    }) as SelfieSegmenter;
    segmenter = activeSegmenter;
    activeSegmenter.setOptions({
      modelSelection: 1,
      selfieMode: false,
    });

    const result = await new Promise<SegmentationResult>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Foreground segmentation timed out.")), 8000);
      activeSegmenter.onResults((results: SegmentationResult) => {
        window.clearTimeout(timeout);
        resolve(results);
      });
      activeSegmenter.send({ image: canvas }).catch(reject);
    });

    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;
    const context = output.getContext("2d");
    if (!context) {
      throw new Error("Failed to create segmentation output.");
    }

    context.drawImage(result.segmentationMask, 0, 0, output.width, output.height);
    context.globalCompositeOperation = "source-in";
    context.drawImage(canvas, 0, 0, output.width, output.height);
    context.globalCompositeOperation = "source-over";

    return output.toDataURL("image/png");
  } catch (error) {
    throw error instanceof Error ? error : new Error("Foreground segmentation failed.");
  } finally {
    segmenter?.close();
  }
}

export async function removeBackgroundDataUrl(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const canvas = createSourceCanvas(image);
  const chromaKey = removeChromaKey(canvas);
  if (isUsableChromaKey(chromaKey)) {
    return chromaKey.dataUrl;
  }

  return removeWithMediaPipe(canvas);
}
