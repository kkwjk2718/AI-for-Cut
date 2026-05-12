import path from "path";
import sharp from "sharp";

export const SHOT_WIDTH = 900;
export const SHOT_HEIGHT = 1200;

const FINAL_WIDTH = 1200;
const FINAL_HEIGHT = 1800;
const PANEL_WIDTH = 492;
const PANEL_HEIGHT = 656;
const LEFT_X = 86;
const RIGHT_X = 622;
const TOP_Y = 86;
const BOTTOM_Y = 794;
const FRAME_RADIUS = 4;
const EVENT_TITLE_LINE_1 = "2026. 진주시와 함께하는 경남과학고등학교";
const EVENT_TITLE_LINE_2 = "수학, 과학, 정보 페스티벌";

function brandAsset(fileName: string): string {
  return path.join(process.cwd(), "public", "brand", fileName);
}

async function roundedMask(width: number, height: number, radius: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function normalizeShotForBooth(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(SHOT_WIDTH, SHOT_HEIGHT, {
      fit: "cover",
      position: "center",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function assertImagePixelLimit(buffer: Buffer): Promise<void> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const maxPixels = 20_000_000;

  if (!width || !height || width * height > maxPixels) {
    throw new Error("이미지 해상도가 너무 큽니다.");
  }
}

export async function assertForegroundHasAlpha(buffer: Buffer): Promise<void> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  let transparentPixels = 0;

  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 250) {
      transparentPixels += 1;
    }
  }

  if (transparentPixels / pixels < 0.01) {
    throw new Error("인물 분리 결과가 확인되지 않았습니다. 다시 촬영해 주세요.");
  }
}

async function makePanel(background: Buffer, foreground: Buffer): Promise<Buffer> {
  const bg = await sharp(background)
    .resize(PANEL_WIDTH, PANEL_HEIGHT, { fit: "cover", position: "center" })
    .png()
    .toBuffer();

  const fg = await sharp(foreground)
    .rotate()
    .resize(PANEL_WIDTH, PANEL_HEIGHT, {
      fit: "cover",
      position: "center",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const panel = await sharp(bg)
    .composite([{ input: fg, left: 0, top: 0 }])
    .png()
    .toBuffer();

  return sharp(panel)
    .composite([{ input: await roundedMask(PANEL_WIDTH, PANEL_HEIGHT, FRAME_RADIUS), blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function panelBorder(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_WIDTH}" height="${PANEL_HEIGHT}">
    <rect x="0" y="0" width="${PANEL_WIDTH}" height="${PANEL_HEIGHT}" rx="${FRAME_RADIUS}" fill="none" stroke="#f8fafc" stroke-width="6"/>
    <rect x="4" y="4" width="${PANEL_WIDTH - 8}" height="${PANEL_HEIGHT - 8}" rx="${FRAME_RADIUS}" fill="none" stroke="#111827" stroke-width="2" opacity="0.55"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function frameDecoration(): Promise<Buffer> {
  const baseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FINAL_WIDTH}" height="${FINAL_HEIGHT}">
    <rect width="${FINAL_WIDTH}" height="${FINAL_HEIGHT}" fill="#050505"/>
    <text x="${FINAL_WIDTH / 2}" y="${FINAL_HEIGHT - 112}" text-anchor="middle" font-family="Malgun Gothic, Arial, sans-serif" font-size="31" font-weight="900" fill="#ffffff">${EVENT_TITLE_LINE_1}</text>
    <text x="${FINAL_WIDTH / 2}" y="${FINAL_HEIGHT - 68}" text-anchor="middle" font-family="Malgun Gothic, Arial, sans-serif" font-size="31" font-weight="900" fill="#ffffff">${EVENT_TITLE_LINE_2}</text>
  </svg>`;

  const schoolMark = await makeSchoolMark();
  const characters = await makeCharacterMark();

  return sharp(Buffer.from(baseSvg))
    .composite([
      { input: schoolMark, left: 72, top: FINAL_HEIGHT - 178 },
      { input: characters, left: FINAL_WIDTH - 292, top: FINAL_HEIGHT - 174 },
    ])
    .png()
    .toBuffer();
}

async function makeSchoolMark(): Promise<Buffer> {
  try {
    return await sharp(brandAsset("school-mark.png"))
      .resize(148, 148, { fit: "cover", position: "center" })
      .composite([{ input: await roundedMask(148, 148, 74), blend: "dest-in" }])
      .png()
      .toBuffer();
  } catch {
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="148" height="148">
      <circle cx="74" cy="74" r="74" fill="#f8fafc"/>
      <text x="74" y="84" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#050505">GSHS</text>
    </svg>`;
    return sharp(Buffer.from(fallback)).png().toBuffer();
  }
}

async function makeCharacterMark(): Promise<Buffer> {
  try {
    return await sharp(brandAsset("keuni-deuri-hands.png"))
      .resize({ width: 220, height: 144, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="144">
      <rect width="220" height="144" rx="20" fill="#f8fafc"/>
      <text x="110" y="84" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="900" fill="#050505">K-D</text>
    </svg>`;
    return sharp(Buffer.from(fallback)).png().toBuffer();
  }
}

function panelPosition(index: number): { left: number; top: number } {
  return {
    left: index % 2 === 0 ? LEFT_X : RIGHT_X,
    top: index < 2 ? TOP_Y : BOTTOM_Y,
  };
}

export async function composeFourCut(background: Buffer, shots: Buffer[]): Promise<Buffer> {
  if (shots.length !== 4) {
    throw new Error("Four shots are required.");
  }

  const normalizedShots = await Promise.all(shots.map((shot) => normalizeShotForBooth(shot)));
  const border = await panelBorder();
  const panels = await Promise.all(normalizedShots.map((shot) => makePanel(background, shot)));
  const frame = await frameDecoration();

  const composites = panels.flatMap((panel, index) => {
    const { left, top } = panelPosition(index);
    return [
      { input: panel, left, top },
      { input: border, left, top },
    ];
  });

  return sharp(frame)
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
}
