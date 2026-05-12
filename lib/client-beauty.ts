"use client";

export type BeautyStrength = 0 | 1 | 2 | 3;

export const BEAUTY_OPTIONS: Array<{
  value: BeautyStrength;
  label: string;
  caption: string;
}> = [
  { value: 0, label: "보정 없음", caption: "원본에 가깝게" },
  { value: 1, label: "자연", caption: "피부톤만 정리" },
  { value: 2, label: "선명", caption: "상용 부스 기본값" },
  { value: 3, label: "화사", caption: "밝고 매끈하게" },
];

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다"));
    image.src = dataUrl;
  });
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function skinMask(red: number, green: number, blue: number): number {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const chroma = max - min;
  const warmSkin =
    red > 68 &&
    green > 38 &&
    blue > 24 &&
    red > green &&
    green >= blue * 0.72 &&
    red - blue > 18 &&
    chroma > 12;
  const brightSkin = red > 95 && green > 65 && blue > 50 && red >= green && red >= blue && chroma < 92;

  if (!warmSkin && !brightSkin) {
    return 0;
  }

  const brightness = (red + green + blue) / 3;
  if (brightness < 48 || brightness > 244) {
    return 0;
  }

  return Math.min(1, Math.max(0.35, (brightness - 48) / 170));
}

export async function applyBeautyFilter(dataUrl: string, strength: BeautyStrength): Promise<string> {
  if (strength === 0) {
    return dataUrl;
  }

  try {
    const image = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return dataUrl;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blurCanvas = document.createElement("canvas");
    blurCanvas.width = canvas.width;
    blurCanvas.height = canvas.height;
    const blurContext = blurCanvas.getContext("2d", { willReadFrequently: true });
    if (!blurContext) {
      return dataUrl;
    }

    const blurRadius = [0, 2.2, 3.6, 5][strength];
    blurContext.filter = `blur(${blurRadius}px)`;
    blurContext.drawImage(canvas, 0, 0);
    blurContext.filter = "none";

    const source = context.getImageData(0, 0, canvas.width, canvas.height);
    const blurred = blurContext.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = source.data;
    const blurPixels = blurred.data;
    const smoothBlend = [0, 0.22, 0.36, 0.5][strength];
    const brightness = [0, 4, 9, 15][strength];
    const contrast = [1, 1.03, 1.06, 1.08][strength];
    const saturation = [1, 1.03, 1.06, 1.08][strength];
    const warmth = [0, 2, 4, 6][strength];

    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];
      if (alpha === 0) {
        continue;
      }

      const mask = skinMask(red, green, blue);
      const blend = mask * smoothBlend;
      const smoothedRed = red * (1 - blend) + blurPixels[index] * blend;
      const smoothedGreen = green * (1 - blend) + blurPixels[index + 1] * blend;
      const smoothedBlue = blue * (1 - blend) + blurPixels[index + 2] * blend;
      const average = (smoothedRed + smoothedGreen + smoothedBlue) / 3;

      pixels[index] = clamp((average + (smoothedRed - average) * saturation - 128) * contrast + 128 + brightness + warmth);
      pixels[index + 1] = clamp((average + (smoothedGreen - average) * saturation - 128) * contrast + 128 + brightness);
      pixels[index + 2] = clamp((average + (smoothedBlue - average) * saturation - 128) * contrast + 128 + brightness - warmth * 0.5);
    }

    context.putImageData(source, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}
