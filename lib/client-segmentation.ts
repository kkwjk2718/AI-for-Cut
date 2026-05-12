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

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    image.src = dataUrl;
  });
}

export async function removeBackgroundDataUrl(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const sourceContext = canvas.getContext("2d");
  if (!sourceContext) {
    throw new Error("인물 분리를 준비하지 못했습니다.");
  }
  sourceContext.drawImage(image, 0, 0, canvas.width, canvas.height);

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
