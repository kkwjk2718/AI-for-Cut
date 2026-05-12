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

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
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
    throw new Error("인물 분리를 준비하지 못했습니다.");
  }
  sourceContext.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function isGreenScreenPixel(red: number, green: number, blue: number): boolean {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const greenDominance = green - Math.max(red, blue);
  return green > 70 && saturation > 0.16 && greenDominance > 24 && green > red * 1.15 && green > blue * 1.1;
}

function removeChromaKey(canvas: HTMLCanvasElement): ChromaKeyResult {
  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  const context = output.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("크로마키 결과를 만들지 못했습니다.");
  }

  context.drawImage(canvas, 0, 0, output.width, output.height);
  const imageData = context.getImageData(0, 0, output.width, output.height);
  const { data } = imageData;
  const marginX = Math.max(12, Math.round(output.width * 0.06));
  const marginY = Math.max(12, Math.round(output.height * 0.06));
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
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const greenDominance = green - Math.max(red, blue);
      const greenScore =
        smoothstep(18, 92, greenDominance) *
        smoothstep(0.14, 0.42, saturation) *
        smoothstep(55, 145, green);
      const removeAmount = isGreenScreenPixel(red, green, blue) ? greenScore : greenScore * 0.45;
      const nextAlpha = removeAmount > 0.88 ? 0 : clamp(Math.round(alpha * (1 - removeAmount)));

      if (nextAlpha < 250) {
        transparentPixels += 1;
      }

      data[index + 3] = nextAlpha < 8 ? 0 : nextAlpha;

      if (nextAlpha > 0 && greenDominance > 0) {
        const spill = smoothstep(5, 60, greenDominance) * smoothstep(0.12, 0.42, saturation) * (nextAlpha / 255);
        data[index + 1] = clamp(Math.round(green - greenDominance * 0.58 * spill));
      }

      if (x < marginX || x >= output.width - marginX || y < marginY || y >= output.height - marginY) {
        edgePixels += 1;
        if (isGreenScreenPixel(red, green, blue)) {
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
  return result.edgeGreenRatio > 0.18 && result.transparentRatio > 0.06 && result.transparentRatio < 0.95;
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
      const timeout = window.setTimeout(() => reject(new Error("인물 분리 시간이 초과되었습니다.")), 8000);
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
      throw new Error("인물 분리 결과를 만들지 못했습니다.");
    }

    context.drawImage(result.segmentationMask, 0, 0, output.width, output.height);
    context.globalCompositeOperation = "source-in";
    context.drawImage(canvas, 0, 0, output.width, output.height);
    context.globalCompositeOperation = "source-over";

    return output.toDataURL("image/png");
  } catch (error) {
    throw error instanceof Error ? error : new Error("인물 분리에 실패했습니다.");
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
