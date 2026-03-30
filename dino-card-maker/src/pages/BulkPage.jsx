import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import domtoimage from "dom-to-image-more";
import CardPreview from "../components/CardPreview";

const BASE = import.meta.env.BASE_URL;

const VALID_TYPES   = ["Predator", "Mother", "Defense", "Flying", "Water"];
const VALID_SIZES   = ["Tiny", "Small", "Medium", "Large", "Giant"];
const VALID_COSTS   = ["0", "1", "2", "Simple"];
const VALID_BONUSES = ["Nest", "Egg", "Predator", "Move", "Draw", "Claim", "Copy"];
const PREFIXES      = ["Before Battle:", "After Battle:", "Special:", "Reaction:", "Ongoing:"];

const EXAMPLE_FILES = [
  "example-images/example-cards.csv",
  "example-images/t-rex.svg",
  "example-images/stegosaurus.svg",
  "example-images/pterodactyl.svg",
];

// Art pane dimensions — must match CardPreview clip container
const ART_W = 294;
const ART_H = 157;

function coverScale(w, h) {
  const r = w / h;
  const R = ART_W / ART_H;
  return r >= R ? (ART_H * r) / ART_W : ART_W / (ART_H * r);
}

function parseEffects(raw) {
  if (!raw && raw !== 0) return [];
  return String(raw)
    .split("|")
    .map((e) => {
      const t = e.trim();
      const prefix = PREFIXES.find((p) => t.startsWith(p));
      return prefix ? { prefix, text: t.slice(prefix.length).trim() } : { prefix: "", text: t };
    })
    .filter((e) => e.text);
}

function parseBattleBonus(raw) {
  if (!raw && raw !== 0) return [];
  return String(raw)
    .split("|")
    .map((s) => {
      const t = s.trim();
      return VALID_BONUSES.find((b) => b.toLowerCase() === t.toLowerCase()) || t;
    })
    .filter(Boolean)
    .slice(0, 3);
}

function parseRow(row) {
  const typeRaw = String(row.type || "").trim();
  const sizeRaw = String(row.size || "").trim();
  const costRaw = row.cost !== undefined && row.cost !== null ? String(row.cost).trim() : "";
  return {
    name:         String(row.name || ""),
    power:        Number(row.power) || 0,
    type:         VALID_TYPES.find((t) => t.toLowerCase() === typeRaw.toLowerCase()) || "",
    size:         VALID_SIZES.find((s) => s.toLowerCase() === sizeRaw.toLowerCase()) || "",
    cost:         VALID_COSTS.find((c) => c.toLowerCase() === costRaw.toLowerCase()) || "",
    battleBonus:  parseBattleBonus(row.battleBonus || row.battle_bonus || ""),
    effects:      parseEffects(row.effects || ""),
    image:        null,
    imageTransform: { x: 0, y: 0, scale: 1 },
  };
}

/** Load a data-URL image and return the best-fit initial scale for the art pane. */
function getInitialScale(src) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload  = () => resolve(Math.round(coverScale(img.naturalWidth, img.naturalHeight) * 100) / 100);
    img.onerror = () => resolve(1);
    img.src = src;
  });
}

/** Normalise a filename stem to a lookup key: lowercase, spaces → hyphens. */
function toKey(str) {
  return str.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Parse a workbook (array buffer) into card rows. */
function parseWorkbook(buffer) {
  const wb   = XLSX.read(buffer, { type: "array" });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  if (!rows.length) throw new Error("No data rows found. Make sure the first row contains column headers.");
  return rows;
}

const CSV_EXAMPLE = `name,power,type,size,cost,battleBonus,effects
T-Rex,8,Predator,Giant,2,Predator|Egg,Before Battle: Gain 2 power|Ongoing: Cannot be blocked by Small or Tiny dinosaurs
Stegosaurus,4,Defense,Large,1,,Ongoing: Reduce all incoming damage by 1|Reaction: When attacked draw a card
Pterodactyl,6,Flying,Medium,2,Draw|Claim,Special: May attack any dinosaur regardless of position|After Battle: Return to hand if this dinosaur survives`;

export default function BulkPage() {
  const [cards, setCards]             = useState([]);
  const [error, setError]             = useState("");
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress]       = useState(0);
  const [exampleLoading, setExampleLoading] = useState(false);
  const cardRefs = useRef([]);

  // ── Single CSV/Excel file upload (no images) ─────────────────────────────
  const handleFile = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows  = parseWorkbook(ev.target.result);
        setCards(rows.map(parseRow));
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ── Folder upload (CSV/Excel + image files) ───────────────────────────────
  const handleFolder = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setError("");

    // 1. Find the data file
    const dataFile = files.find((f) => /\.(csv|xlsx|xls)$/i.test(f.name));
    if (!dataFile) {
      setError("No CSV or Excel file found in the selected folder.");
      return;
    }

    // 2. Load all image files into a name→dataURL map
    const imageFiles = files.filter((f) => /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(f.name));
    const imageMap   = {};
    await Promise.all(
      imageFiles.map(
        (f) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              imageMap[toKey(f.name.replace(/\.[^.]+$/, ""))] = ev.target.result;
              resolve();
            };
            reader.readAsDataURL(f);
          })
      )
    );

    // 3. Parse the data file
    const buffer = await dataFile.arrayBuffer();
    let rows;
    try {
      rows = parseWorkbook(buffer);
    } catch (err) {
      setError(err.message);
      return;
    }

    // 4. Match images to cards by name (and optional explicit `image` column)
    const parsed = await Promise.all(
      rows.map(async (row) => {
        const card       = parseRow(row);
        const nameKey    = toKey(card.name);
        const explicitKey = row.image ? toKey(String(row.image).replace(/\.[^.]+$/, "")) : null;
        const src        = (explicitKey && imageMap[explicitKey]) || imageMap[nameKey] || null;

        if (src) {
          const scale          = await getInitialScale(src);
          card.image           = src;
          card.imageTransform  = { x: 0, y: 0, scale };
        }
        return card;
      })
    );

    setCards(parsed);
  }, []);

  // ── Download all cards as a ZIP ───────────────────────────────────────────
  const handleDownloadAll = async () => {
    if (!cards.length) return;
    setDownloading(true);
    setProgress(0);

    const zip = new JSZip();
    for (let i = 0; i < cards.length; i++) {
      const el = cardRefs.current[i];
      if (!el) continue;
      try {
        const dataUrl = await domtoimage.toPng(el, {
          width: 756, height: 1051,
          style: { transform: "scale(2.52)", transformOrigin: "top left", width: "300px", height: "417px" },
        });
        zip.file(`${cards[i].name || `card-${i + 1}`}.png`, dataUrl.split(",")[1], { base64: true });
      } catch (err) {
        console.error(`Card ${i} render failed:`, err);
      }
      setProgress(i + 1);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "dino-cards.zip" }).click();
    URL.revokeObjectURL(url);
    setDownloading(false);
    setProgress(0);
  };

  // ── Download example folder as ZIP ───────────────────────────────────────
  const handleDownloadExample = async () => {
    setExampleLoading(true);
    try {
      const zip = new JSZip();
      await Promise.all(
        EXAMPLE_FILES.map(async (path) => {
          const res      = await fetch(`${BASE}${path}`);
          const blob     = await res.blob();
          zip.file(path.split("/").pop(), blob);
        })
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url  = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), { href: url, download: "dino-cards-example.zip" }).click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to build example ZIP: " + err.message);
    }
    setExampleLoading(false);
  };

  return (
    <div className="bulk-page">

      {/* ── Format docs ── */}
      <section className="bulk-docs">
        <h2 className="section-label">CSV / Excel Format</h2>
        <p className="bulk-docs-intro">
          One card per row. The first row must be a header with the column names below.
          To include artwork, place image files in the same folder as your CSV — images are matched
          to cards by name (e.g. a card named <strong>T-Rex</strong> will use <strong>T-Rex.png</strong> or{" "}
          <strong>t-rex.svg</strong>, etc.). You can also add an optional <code>image</code> column
          with the exact filename to use.
        </p>

        <div className="bulk-table-wrap">
          <table className="bulk-schema-table">
            <thead>
              <tr><th>Column</th><th>Accepted values</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td><code>name</code></td><td>Any text</td><td>Card name — also used to match an image file</td></tr>
              <tr><td><code>power</code></td><td>Number — e.g. <code>5</code></td><td>Power value shown in top-right</td></tr>
              <tr>
                <td><code>type</code></td>
                <td><code>Predator</code> · <code>Mother</code> · <code>Defense</code> · <code>Flying</code> · <code>Water</code></td>
                <td>Leave blank for no type background</td>
              </tr>
              <tr>
                <td><code>size</code></td>
                <td><code>Tiny</code> · <code>Small</code> · <code>Medium</code> · <code>Large</code> · <code>Giant</code></td>
                <td>Leave blank to omit</td>
              </tr>
              <tr><td><code>cost</code></td><td><code>0</code> · <code>1</code> · <code>2</code> · <code>Simple</code></td><td>Leave blank to omit</td></tr>
              <tr>
                <td><code>battleBonus</code></td>
                <td>Pipe-separated — e.g. <code>Move|Draw</code></td>
                <td>Max 3 from: <code>Nest</code> <code>Egg</code> <code>Predator</code> <code>Move</code> <code>Draw</code> <code>Claim</code> <code>Copy</code></td>
              </tr>
              <tr>
                <td><code>effects</code></td>
                <td>Pipe-separated — e.g. <code>Ongoing: text|Special: text</code></td>
                <td>Prefix optional: <code>Before Battle:</code> <code>After Battle:</code> <code>Special:</code> <code>Reaction:</code> <code>Ongoing:</code></td>
              </tr>
              <tr><td><code>image</code></td><td>Filename — e.g. <code>my-dino.png</code></td><td>Optional override — otherwise the card name is used</td></tr>
            </tbody>
          </table>
        </div>

        <div className="bulk-docs-example-header">
          <p className="bulk-docs-example-label">Example CSV</p>
          <button
            className="bulk-example-download"
            onClick={handleDownloadExample}
            disabled={exampleLoading}
          >
            {exampleLoading ? "Building…" : "↓ Download example folder (ZIP)"}
          </button>
        </div>
        <pre className="bulk-csv-example">{CSV_EXAMPLE}</pre>
        <p className="bulk-docs-intro" style={{ marginTop: 0 }}>
          The example ZIP contains the CSV above plus matching SVG artwork for each card.
          Unzip it, then use <strong>Upload folder</strong> below to try it out.
        </p>
      </section>

      {/* ── Upload ── */}
      <section className="bulk-upload-section">
        <div className="bulk-upload-grid">
          <label className="upload-label bulk-upload-option">
            <span className="bulk-upload-title">CSV or Excel only</span>
            <span className="bulk-upload-hint">No images — text data only</span>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} hidden />
          </label>

          <label className="upload-label bulk-upload-option">
            <span className="bulk-upload-title">Folder with images</span>
            <span className="bulk-upload-hint">CSV + image files in one folder</span>
            <input
              type="file"
              // @ts-ignore — webkitdirectory is non-standard but widely supported
              webkitdirectory=""
              onChange={handleFolder}
              hidden
            />
          </label>
        </div>
        {error && <p className="bulk-error">{error}</p>}
      </section>

      {/* ── Results ── */}
      {cards.length > 0 && (
        <section className="bulk-results">
          <div className="bulk-results-header">
            <span className="section-label">
              {cards.length} card{cards.length !== 1 ? "s" : ""}
              {cards.filter((c) => c.image).length > 0 && (
                <span className="count-badge" style={{ marginLeft: 8 }}>
                  {cards.filter((c) => c.image).length} with artwork
                </span>
              )}
            </span>
            <button
              className="download-btn bulk-download-btn"
              onClick={handleDownloadAll}
              disabled={downloading}
            >
              {downloading ? `Rendering… ${progress} / ${cards.length}` : "↓ Download All as ZIP"}
            </button>
          </div>

          {/* Full-size cards for dom-to-image capture, off-screen */}
          <div className="bulk-capture-layer" aria-hidden="true">
            {cards.map((card, i) => (
              <CardPreview
                key={i}
                ref={(el) => { cardRefs.current[i] = el; }}
                name={card.name}
                power={card.power}
                battleBonus={card.battleBonus}
                size={card.size}
                type={card.type}
                cost={card.cost}
                effects={card.effects}
                image={card.image}
                imageTransform={card.imageTransform}
              />
            ))}
          </div>

          {/* Visible scaled grid */}
          <div className="bulk-cards-grid">
            {cards.map((card, i) => (
              <div key={i} className="bulk-card-item">
                <div className="bulk-card-scaled">
                  <CardPreview
                    name={card.name}
                    power={card.power}
                    battleBonus={card.battleBonus}
                    size={card.size}
                    type={card.type}
                    cost={card.cost}
                    effects={card.effects}
                    image={card.image}
                    imageTransform={card.imageTransform}
                  />
                </div>
                <span className="bulk-card-label">{card.name || `Card ${i + 1}`}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
