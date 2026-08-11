import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const markSvgPath = path.join(rootDir, 'src', 'assets', 'icons', 'litho-mark.svg');
const ogImagePath = path.join(publicDir, 'logo.jpg');
const legacyOgImagePath = path.join(publicDir, 'logo.png');
const faviconIcoPath = path.join(publicDir, 'favicon.ico');
const tempFaviconPngPath = path.join(publicDir, '.favicon-tmp.png');

const readSvg = async (sourcePath) => fs.readFile(sourcePath, 'utf8');

const createIconDirHeader = (imageLength, size) => {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(size === 256 ? 0 : size, 6);
  header.writeUInt8(size === 256 ? 0 : size, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(imageLength, 14);
  header.writeUInt32LE(22, 18);
  return header;
};

const writeIcoFromPng = async ({ pngPath, icoPath, size }) => {
  const pngBytes = await fs.readFile(pngPath);
  const iconDir = createIconDirHeader(pngBytes.length, size);
  await fs.writeFile(icoPath, Buffer.concat([iconDir, pngBytes]));
};

const renderOgImage = async (page, markSvg) => {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          :root {
            color-scheme: dark;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            background: #05080f;
            font-family: Inter, Segoe UI, Arial, sans-serif;
          }

          .frame {
            position: relative;
            width: 1200px;
            height: 630px;
            overflow: hidden;
            background:
              radial-gradient(circle at top right, rgba(11, 133, 255, 0.22), transparent 33%),
              radial-gradient(circle at bottom left, rgba(0, 233, 255, 0.2), transparent 42%),
              linear-gradient(140deg, #05080f 0%, #08111d 52%, #091725 100%);
            color: #ffffff;
          }

          .glow {
            position: absolute;
            border-radius: 999px;
            filter: blur(20px);
            opacity: 0.6;
          }

          .glow-primary {
            top: 76px;
            right: 112px;
            width: 220px;
            height: 220px;
            background: rgba(11, 133, 255, 0.38);
          }

          .glow-secondary {
            bottom: 58px;
            left: 86px;
            width: 280px;
            height: 280px;
            background: rgba(0, 233, 255, 0.26);
          }

          .content {
            position: relative;
            z-index: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            width: 100%;
            height: 100%;
            padding: 76px 92px;
          }

          .pill {
            display: inline-flex;
            align-items: center;
            width: fit-content;
            padding: 10px 18px;
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.9);
            font-size: 18px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .hero {
            display: flex;
            align-items: center;
            gap: 28px;
            margin-top: 28px;
          }

          .mark {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 132px;
            height: 148px;
            padding: 8px;
            border-radius: 32px;
            background: rgba(255, 255, 255, 0.04);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
          }

          .mark svg {
            display: block;
            width: 100%;
            height: auto;
          }

          .title {
            margin: 0 0 14px;
            font-size: 84px;
            font-weight: 800;
            line-height: 0.98;
            letter-spacing: -0.05em;
          }

          .subtitle {
            margin: 0;
            max-width: 780px;
            color: rgba(255, 255, 255, 0.78);
            font-size: 29px;
            line-height: 1.35;
          }

          .footer {
            position: absolute;
            left: 92px;
            bottom: 74px;
            color: rgba(255, 255, 255, 0.58);
            font-size: 22px;
            line-height: 1.3;
          }
        </style>
      </head>
      <body>
        <div class="frame">
          <div class="glow glow-primary"></div>
          <div class="glow glow-secondary"></div>
          <div class="content">
            <div class="pill">Lithosphere Kamet</div>
            <div class="hero">
              <div class="mark" aria-hidden="true">${markSvg}</div>
              <div>
                <h1 class="title">Kamet Explorer</h1>
                <p class="subtitle">
                  Blocks, transactions, addresses, validators, tokens, contracts, and
                  real-time network health.
                </p>
              </div>
            </div>
          </div>
          <div class="footer">kamet.litho.ai</div>
        </div>
      </body>
    </html>`);
  await page.locator('.frame').screenshot({ path: ogImagePath, type: 'jpeg', quality: 76 });
};

const renderFavicon = async (page, markSvg) => {
  const iconSize = 64;
  await page.setViewportSize({ width: iconSize, height: iconSize });
  await page.setContent(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          html,
          body {
            width: ${iconSize}px;
            height: ${iconSize}px;
            margin: 0;
            background: transparent;
          }

          body {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .mark {
            width: ${iconSize}px;
            height: ${iconSize}px;
          }

          .mark svg {
            display: block;
            width: 100%;
            height: auto;
          }
        </style>
      </head>
      <body>
        <div class="mark" aria-hidden="true">${markSvg}</div>
      </body>
    </html>`);
  await page.screenshot({ path: tempFaviconPngPath, type: 'png', omitBackground: true });
  await writeIcoFromPng({ pngPath: tempFaviconPngPath, icoPath: faviconIcoPath, size: iconSize });
  await fs.unlink(tempFaviconPngPath);
};

const browser = await chromium.launch();
const markSvg = await readSvg(markSvgPath);

try {
  const ogPage = await browser.newPage();
  await renderOgImage(ogPage, markSvg);
  await ogPage.close();

  const faviconPage = await browser.newPage();
  await renderFavicon(faviconPage, markSvg);
  await faviconPage.close();
  await fs.rm(legacyOgImagePath, { force: true });
} finally {
  await browser.close();
}
