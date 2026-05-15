"use client";

import type { BeautyStrength } from "@/lib/client-beauty";
import type { Effect, Player } from "@banuba/webar";

interface BanubaRuntime {
  player: Player;
  effect: Effect;
}

const BANUBA_ROOT = "/vendor/banuba";
const BANUBA_MODULES = ["background", "eyes", "face_tracker", "hair", "lips", "skin"] as const;
const BANUBA_EFFECT = `${BANUBA_ROOT}/effects/Makeup_new_morphs.zip`;
const BANUBA_TOTAL_TIMEOUT_MS = 6000;
const BANUBA_RENDER_TIMEOUT_MS = 3500;
const SUPPORTED_INPUT_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const BANUBA_STAGE: Record<
  BeautyStrength,
  {
    skinSoftening: number;
    skinToneAlpha: number;
    faceMorph: number;
    noseMorph: number;
  }
> = {
  0: { skinSoftening: 0, skinToneAlpha: 0, faceMorph: 0, noseMorph: 0 },
  1: { skinSoftening: 0.18, skinToneAlpha: 0.04, faceMorph: 0.04, noseMorph: 0.01 },
  2: { skinSoftening: 0.32, skinToneAlpha: 0.07, faceMorph: 0.08, noseMorph: 0.02 },
  3: { skinSoftening: 0.48, skinToneAlpha: 0.1, faceMorph: 0.12, noseMorph: 0.03 },
  4: { skinSoftening: 0.62, skinToneAlpha: 0.13, faceMorph: 0.16, noseMorph: 0.04 },
};

let runtimePromise: Promise<BanubaRuntime | null> | null = null;
let banubaUnavailable = false;
let processingQueue: Promise<unknown> = Promise.resolve();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function getClientToken(): string | null {
  const token = process.env.NEXT_PUBLIC_BANUBA_CLIENT_TOKEN?.trim();
  return token || null;
}

async function getRuntime(): Promise<BanubaRuntime | null> {
  if (banubaUnavailable) {
    return null;
  }

  const clientToken = getClientToken();
  if (!clientToken) {
    banubaUnavailable = true;
    return null;
  }

  if (!runtimePromise) {
    runtimePromise = createRuntime(clientToken).catch(() => {
      banubaUnavailable = true;
      return null;
    });
  }

  return runtimePromise;
}

async function createRuntime(clientToken: string): Promise<BanubaRuntime> {
  const banuba = await import("@banuba/webar");
  const [player, modules, effect] = await Promise.all([
    banuba.Player.create({
      clientToken,
      devicePixelRatio: 1,
      locateFile: {
        "BanubaSDK.data": `${BANUBA_ROOT}/BanubaSDK.data`,
        "BanubaSDK.wasm": `${BANUBA_ROOT}/BanubaSDK.wasm`,
        "BanubaSDK.simd.wasm": `${BANUBA_ROOT}/BanubaSDK.simd.wasm`,
      },
      logger: {} as Console,
    }),
    banuba.Module.preload(BANUBA_MODULES.map((name) => `${BANUBA_ROOT}/modules/${name}.zip`)),
    banuba.Effect.preload(BANUBA_EFFECT),
  ]);

  await player.addModule(...modules);
  await player.applyEffect(effect);

  return { player, effect };
}

function dataUrlMimeType(dataUrl: string): string | null {
  return dataUrl.match(/^data:(.*?);base64,/)?.[1]?.toLowerCase() ?? null;
}

function isSupportedDataUrl(dataUrl: string): boolean {
  const mime = dataUrlMimeType(dataUrl);
  return Boolean(mime && SUPPORTED_INPUT_MIME_TYPES.has(mime));
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [metadata, encoded] = dataUrl.split(",");
  const mime = metadata.match(/^data:(.*?);base64$/)?.[1] ?? "image/png";
  const binary = window.atob(encoded ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read Banuba output."));
    reader.readAsDataURL(blob);
  });
}

function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Failed to load image size."));
    image.src = dataUrl;
  });
}

function waitForRenderedFrame(player: Player, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      player.removeEventListener("framerendered", onFrame);
      reject(new Error("Banuba render timed out."));
    }, timeoutMs);

    const onFrame = () => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      player.removeEventListener("framerendered", onFrame);
      resolve();
    };

    player.addEventListener("framerendered", onFrame);
  });
}

function beautyScript(strength: BeautyStrength): string {
  const stage = BANUBA_STAGE[strength];
  const skinColor = `1.00 0.86 0.66 ${stage.skinToneAlpha.toFixed(2)}`;

  return [
    "Skin.softening(0)",
    'Skin.color("0 0 0 0")',
    "FaceMorph.face(0)",
    "FaceMorph.nose(0)",
    "FaceMorph.eyes(0)",
    "FaceMorph.lips(0)",
    "Softlight.strength(0)",
    `Skin.softening(${stage.skinSoftening.toFixed(2)})`,
    stage.skinToneAlpha > 0 ? `Skin.color("${skinColor}")` : "",
    `FaceMorph.face(${stage.faceMorph.toFixed(2)})`,
    `FaceMorph.nose(${stage.noseMorph.toFixed(2)})`,
  ]
    .filter(Boolean)
    .join(";");
}

async function runBanubaBeauty(dataUrl: string, strength: BeautyStrength): Promise<string | null> {
  const runtime = await getRuntime();
  if (!runtime) {
    return null;
  }

  const banuba = await import("@banuba/webar");
  const [{ width, height }, inputBlob] = await Promise.all([loadImageSize(dataUrl), Promise.resolve(dataUrlToBlob(dataUrl))]);
  await runtime.effect.evalJs(beautyScript(strength));

  const renderWait = waitForRenderedFrame(runtime.player, BANUBA_RENDER_TIMEOUT_MS);
  runtime.player.use(new banuba.Image(inputBlob));
  runtime.player.play({ pauseOnEmpty: false });
  await renderWait;
  await new Promise((resolve) => window.setTimeout(resolve, 80));

  const capture = new banuba.ImageCapture(runtime.player);
  const output = await capture.takePhoto({ width, height, type: "image/png" });
  return blobToDataUrl(output);
}

export function applyBanubaBeautyFilter(dataUrl: string, strength: BeautyStrength): Promise<string | null> {
  if (strength === 0) {
    return Promise.resolve(dataUrl);
  }

  if (banubaUnavailable || !isSupportedDataUrl(dataUrl)) {
    return Promise.resolve(null);
  }

  const task = processingQueue
    .catch(() => undefined)
    .then(() => {
      if (banubaUnavailable) {
        return null;
      }
      return withTimeout(runBanubaBeauty(dataUrl, strength), BANUBA_TOTAL_TIMEOUT_MS, "Banuba beauty timed out.");
    })
    .catch(() => {
      banubaUnavailable = true;
      return null;
    });

  processingQueue = task.catch(() => null);
  return task;
}
