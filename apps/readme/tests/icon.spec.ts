import { createIconDataUrl, iconPreviewSizes } from "@jongminchung/icon";
import { expect, test } from "@playwright/test";

test("visual: app icon family at production sizes", async ({ page }) => {
  const personalIcon = createIconDataUrl("personal");
  const productIcon = createIconDataUrl("immersive-translate");
  const cells = iconPreviewSizes
    .map(
      (size) => `
        <div class="cell">
          <div class="stage"><img src="${personalIcon}" width="${size}" height="${size}" /></div>
          <span>${size}px</span>
        </div>`,
    )
    .join("");
  const productCells = iconPreviewSizes
    .map(
      (size) => `
        <div class="cell">
          <div class="stage"><img src="${productIcon}" width="${size}" height="${size}" /></div>
          <span>${size}px</span>
        </div>`,
    )
    .join("");

  await page.setViewportSize({ width: 1280, height: 1040 });
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 48px; background: #f4f6fb; color: #121826; font-family: Arial, sans-serif; }
          header { display: flex; justify-content: space-between; align-items: end; margin-bottom: 42px; border-bottom: 1px solid #cbd2df; padding-bottom: 18px; }
          h1 { margin: 0; font-size: 28px; letter-spacing: -0.04em; }
          header span, .cell span { color: #596174; font-family: monospace; font-size: 11px; }
          section + section { margin-top: 54px; }
          h2 { margin: 0 0 18px; font-size: 16px; }
          .row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 12px; align-items: end; }
          .cell { display: grid; gap: 10px; justify-items: center; }
          .stage { display: grid; width: 100%; height: 270px; place-items: center; border: 1px solid #cbd2df; background: white; }
          img { display: block; max-width: 100%; }
          .contrast { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
          .mode { display: flex; height: 168px; align-items: center; justify-content: center; gap: 28px; border: 1px solid #cbd2df; }
          .mode.light { background: white; }
          .mode.dark { border-color: #293247; background: #070a12; }
          .mode.mono { background: #dfe3eb; }
          .mode.mono img { filter: grayscale(1); }
        </style>
      </head>
      <body>
        <header><h1>Jamie · Open Weave</h1><span>LIGHT / 16—256</span></header>
        <section><h2>Personal mark</h2><div class="row">${cells}</div></section>
        <section><h2>Immersive Translate · exchange lanes</h2><div class="row">${productCells}</div></section>
        <section>
          <h2>Contrast modes · 64px</h2>
          <div class="contrast">
            <div class="mode light"><img src="${personalIcon}" width="64" height="64" /><img src="${productIcon}" width="64" height="64" /></div>
            <div class="mode dark"><img src="${personalIcon}" width="64" height="64" /><img src="${productIcon}" width="64" height="64" /></div>
            <div class="mode mono"><img src="${personalIcon}" width="64" height="64" /><img src="${productIcon}" width="64" height="64" /></div>
          </div>
        </section>
      </body>
    </html>
  `);

  await expect(page).toHaveScreenshot("app-icon-size-sheet.png", {
    animations: "disabled",
    fullPage: true,
  });
});
