"use client";

type SegmentationResult = {
  segmentationMask: CanvasImageSource;
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
  try {
    const image = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const sourceContext = canvas.getContext("2d");
    if (!sourceContext) {
      return dataUrl;
    }
    sourceContext.drawImage(image, 0, 0, canvas.width, canvas.height);

    const { SelfieSegmentation } = await import("@mediapipe/selfie_segmentation");
    const segmenter = new SelfieSegmentation({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });
    segmenter.setOptions({
      modelSelection: 1,
      selfieMode: false,
    });

    const result = await new Promise<SegmentationResult>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("인물 분리 시간이 초과되었습니다.")), 8000);
      segmenter.onResults((results: SegmentationResult) => {
        window.clearTimeout(timeout);
        resolve(results);
      });
      segmenter.send({ image: canvas }).catch(reject);
    });

    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;
    const context = output.getContext("2d");
    if (!context) {
      return dataUrl;
    }

    context.drawImage(result.segmentationMask, 0, 0, output.width, output.height);
    context.globalCompositeOperation = "source-in";
    context.drawImage(canvas, 0, 0, output.width, output.height);
    context.globalCompositeOperation = "source-over";

    segmenter.close();
    return output.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}
