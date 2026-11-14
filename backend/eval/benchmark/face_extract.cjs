/**
 * Compute face descriptors for a list of images with the app's own face-api.js
 * models, in a headless browser (the app computes them in the browser too).
 *
 * usage: node face_extract.cjs <server base url> <list.txt> <out.json>
 *   list.txt: one image URL path per line (e.g. /data/lfw/Name/Name_0001.jpg)
 *   out.json: { "<path>": { "enrol": [128 floats] | null, "probe": [...] | null } }
 * Resumes if out.json already exists. Needs playwright-core (NODE_PATH) and Edge or Chrome.
 */
const fs = require('fs');
const { chromium } = require('playwright-core');

const [base, listPath, outPath] = process.argv.slice(2);
const all = fs.readFileSync(listPath, 'utf8').split(/\r?\n/).filter(Boolean);
const done = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
const todo = all.filter(p => !(p in done));
console.log(`${all.length} images, ${todo.length} to do`);

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(`${base}/web/face_page.html`);
  const backend = await page.evaluate(() => window.ready);
  console.log('models loaded, tf backend:', backend);

  const BATCH = 50;
  const t0 = Date.now();
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const res = await page.evaluate(urls => window.describeBatch(urls), batch);
    Object.assign(done, res);
    fs.writeFileSync(outPath, JSON.stringify(done));
    const n = i + batch.length;
    const rate = n / ((Date.now() - t0) / 1000);
    const detected = Object.values(done).filter(v => v && v.probe).length;
    console.log(`${n}/${todo.length}  ${rate.toFixed(1)} img/s  faces found so far: ${detected}/${Object.keys(done).length}`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
