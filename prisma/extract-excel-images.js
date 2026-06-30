/**
 * Extracts embedded images from customer-app/data.xlsx
 * and saves them to backend/uploads/custom/ with names the seed can use.
 *
 * Run: node prisma/extract-excel-images.js
 *
 * Output naming:
 *   {slug}-logo.jpg        → restaurant logo (row 0 in each sheet)
 *   {slug}-item-{row}.jpg  → menu-item image (anchored at that row in the sheet)
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const XLSX_PATH = path.resolve(__dirname, '../../customer-app/data.xlsx');
const OUT_DIR   = path.resolve(__dirname, '../uploads/custom');

// ── helpers ────────────────────────────────────────────────────────────────────
function slugify(name) {
  return name.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function readFromZip(inner) {
  try {
    return execSync(`unzip -p "${XLSX_PATH}" "${inner}"`, { maxBuffer: 20 * 1024 * 1024 });
  } catch { return null; }
}

/** rId → media filename, e.g. rId1 → "image1.jpeg" */
function parseRels(xml) {
  const map = new Map();
  const re = /Id="(rId\d+)"[^>]*Target="\.\.\/media\/([^"]+)"/g;
  let m;
  while ((m = re.exec(xml)) !== null) map.set(m[1], m[2]);
  return map;
}

/** row → rId (first anchor at that row; skips anchors with no image) */
function parseDrawing(xml) {
  const map = new Map();
  // Split on anchor opening tags
  const blocks = xml.split(/<xdr:(?:two|one)CellAnchor/);
  for (const block of blocks.slice(1)) {
    const rowM = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
    const ridM = block.match(/r:embed="(rId\d+)"/);
    if (!rowM || !ridM) continue;
    const row = parseInt(rowM[1], 10);
    if (!map.has(row)) map.set(row, ridM[1]);
  }
  return map;
}

// ── sheet name → slug (must match what seed-custom.ts uses) ──────────────────
const SHEET_SLUGS = {
  "Restaurant O'délice": "restaurant-o-delice",
  "Restaurant Ochoix":   "restaurant-ochoix",
  "Restaurant Victoria": "restaurant-victoria",
  "Mondial Pizza":       "mondial-pizza",
  "Bk's burger":         "bk-s-burger",
};

// ── read workbook to get sheet order ─────────────────────────────────────────
const wbXml = readFromZip('xl/workbook.xml').toString('utf8');
const sheetMatches = [...wbXml.matchAll(/name="([^"]+)"/g)].map(m =>
  m[1].trim()
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
);

fs.mkdirSync(OUT_DIR, { recursive: true });

let saved = 0;
let skipped = 0;

sheetMatches.forEach((sheetName, idx) => {
  const sheetNum = idx + 1;
  const slug = SHEET_SLUGS[sheetName];
  if (!slug) {
    console.warn(`  ⚠ Unknown sheet "${sheetName}" — skipping`);
    return;
  }

  console.log(`\n📂  ${sheetName} (sheet${sheetNum}) → ${slug}`);

  // Find which drawing this sheet uses
  const sheetRelsXml = readFromZip(`xl/worksheets/_rels/sheet${sheetNum}.xml.rels`);
  if (!sheetRelsXml) { console.warn('   no rels file'); return; }
  const drawingMatch = sheetRelsXml.toString().match(/Target="\.\.\/drawings\/(drawing\d+\.xml)"/);
  if (!drawingMatch) { console.warn('   no drawing reference'); return; }
  const drawingFile = drawingMatch[1];                          // e.g. "drawing1.xml"
  const drawingNum  = drawingFile.match(/\d+/)[0];

  // Parse drawing rels: rId → media filename
  const drawingRelsXml = readFromZip(`xl/drawings/_rels/${drawingFile}.rels`);
  if (!drawingRelsXml) { console.warn('   no drawing rels'); return; }
  const rIdToMedia = parseRels(drawingRelsXml.toString());

  // Parse drawing: row → rId
  const drawingXml = readFromZip(`xl/drawings/${drawingFile}`);
  if (!drawingXml) { console.warn('   no drawing XML'); return; }
  const rowToRid = parseDrawing(drawingXml.toString());

  // Process each anchored image
  for (const [row, rId] of rowToRid) {
    const mediaFile = rIdToMedia.get(rId);
    if (!mediaFile) continue;

    const innerPath = `xl/media/${mediaFile}`;
    const ext = path.extname(mediaFile).toLowerCase(); // ".jpeg" or ".png"
    const outExt = ext === '.png' ? '.png' : '.jpg';

    let outName;
    if (row === 0) {
      outName = `${slug}-logo${outExt}`;
    } else {
      outName = `${slug}-item-${row}${outExt}`;
    }

    const outPath = path.join(OUT_DIR, outName);
    const imgBuf  = readFromZip(innerPath);
    if (!imgBuf) { skipped++; continue; }

    fs.writeFileSync(outPath, imgBuf);
    saved++;
    if (row === 0) console.log(`  ✓ logo   → ${outName}`);
  }

  const itemCount = [...rowToRid.keys()].filter(r => r > 0).length;
  console.log(`  ✓ items  → ${itemCount} item images saved`);
});

console.log(`\n✅  Done: ${saved} images saved to ${OUT_DIR}`);
console.log(`   ${skipped} failed to extract`);
