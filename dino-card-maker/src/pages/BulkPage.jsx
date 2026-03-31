import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import domtoimage from "dom-to-image-more";
import CardPreview from "../components/CardPreview";
import PrintModal from "../components/PrintModal";

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

function maxOffsets(naturalW, naturalH, scale) {
  const r = naturalW / naturalH;
  const R = ART_W / ART_H;
  const contentW = r >= R ? ART_W : ART_H * r;
  const contentH = r >= R ? ART_W / r : ART_H;
  return {
    maxX: Math.max(0, Math.floor((contentW * scale - ART_W) / 2)),
    maxY: Math.max(0, Math.floor((contentH * scale - ART_H) / 2)),
  };
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
    naturalW:     ART_W,
    naturalH:     ART_H,
  };
}

/** Load a data-URL image and return initial scale + natural dimensions for the art pane. */
function getImageMeta(src) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload  = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      resolve({ scale: Math.round(coverScale(w, h) * 100) / 100, naturalW: w, naturalH: h });
    };
    img.onerror = () => resolve({ scale: 1, naturalW: ART_W, naturalH: ART_H });
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
  const [reviewMode, setReviewMode]   = useState(false);
  const [reviewStep, setReviewStep]   = useState(0);
  const [printOpen, setPrintOpen]     = useState(false);
  const cardRefs = useRef([]);

  // Indices into `cards` that have an image
  const imageCardIndices = cards.map((c, i) => (c.image ? i : -1)).filter((i) => i >= 0);
  const reviewCardIndex  = imageCardIndices[reviewStep];
  const reviewCard       = reviewCardIndex !== undefined ? cards[reviewCardIndex] : null;
  const reviewOffsets    = reviewCard
    ? maxOffsets(reviewCard.naturalW, reviewCard.naturalH, reviewCard.imageTransform.scale)
    : { maxX: 0, maxY: 0 };

  const handleReviewTransform = useCallback((key) => (e) => {
    const val = Number(e.target.value);
    setCards((prev) => prev.map((c, i) => {
      if (i !== reviewCardIndex) return c;
      const t    = c.imageTransform;
      const next = { ...t, [key]: val };
      if (key === "scale") {
        const { maxX: mX, maxY: mY } = maxOffsets(c.naturalW, c.naturalH, val);
        next.x = Math.max(-mX, Math.min(mX, t.x));
        next.y = Math.max(-mY, Math.min(mY, t.y));
      }
      return { ...c, imageTransform: next };
    }));
  }, [reviewCardIndex]);

  const handleReviewReset = useCallback(() => {
    setCards((prev) => prev.map((c, i) => {
      if (i !== reviewCardIndex) return c;
      const scale = Math.round(coverScale(c.naturalW, c.naturalH) * 100) / 100;
      return { ...c, imageTransform: { x: 0, y: 0, scale } };
    }));
  }, [reviewCardIndex]);

  // ── Single CSV/Excel file upload (no images) ─────────────────────────────
  const handleFile = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setReviewMode(false);
    setReviewStep(0);
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
    setReviewMode(false);
    setReviewStep(0);

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
        const card        = parseRow(row);
        const nameKey     = toKey(card.name);
        const explicitKey = row.image ? toKey(String(row.image).replace(/\.[^.]+$/, "")) : null;
        const src         = (explicitKey && imageMap[explicitKey]) || imageMap[nameKey] || null;

        if (src) {
          const { scale, naturalW, naturalH } = await getImageMeta(src);
          card.image          = src;
          card.imageTransform = { x: 0, y: 0, scale };
          card.naturalW       = naturalW;
          card.naturalH       = naturalH;
        }
        return card;
      })
    );

    setCards(parsed);
    if (parsed.some((c) => c.image)) {
      setReviewMode(true);
      setReviewStep(0);
    }
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

      {/* ── Image review (one card at a time) ── */}
      {reviewMode && reviewCard && (
        <section className="bulk-review">
          <div className="bulk-review-header">
            <span className="section-label">
              Review Artwork
              <span className="count-badge" style={{ marginLeft: 8 }}>
                {reviewStep + 1} / {imageCardIndices.length}
              </span>
            </span>
            <button className="link-btn" onClick={() => setReviewMode(false)}>
              Skip Review
            </button>
          </div>

          <div className="bulk-review-body">
            <div className="bulk-review-card">
              <CardPreview
                name={reviewCard.name}
                power={reviewCard.power}
                battleBonus={reviewCard.battleBonus}
                size={reviewCard.size}
                type={reviewCard.type}
                cost={reviewCard.cost}
                effects={reviewCard.effects}
                image={reviewCard.image}
                imageTransform={reviewCard.imageTransform}
              />
            </div>

            <div className="bulk-review-controls">
              <p className="bulk-review-card-name">{reviewCard.name || `Card ${reviewCardIndex + 1}`}</p>
              <div className="image-transform">
                <div className="field">
                  <label>X <span className="value-badge">{reviewCard.imageTransform.x}px</span></label>
                  <input
                    type="range"
                    min={-reviewOffsets.maxX} max={reviewOffsets.maxX}
                    value={reviewCard.imageTransform.x}
                    onChange={handleReviewTransform("x")}
                    disabled={reviewOffsets.maxX === 0}
                  />
                </div>
                <div className="field">
                  <label>Y <span className="value-badge">{reviewCard.imageTransform.y}px</span></label>
                  <input
                    type="range"
                    min={-reviewOffsets.maxY} max={reviewOffsets.maxY}
                    value={reviewCard.imageTransform.y}
                    onChange={handleReviewTransform("y")}
                    disabled={reviewOffsets.maxY === 0}
                  />
                </div>
                <div className="field">
                  <label>Scale <span className="value-badge">{reviewCard.imageTransform.scale.toFixed(2)}×</span></label>
                  <input
                    type="range"
                    min="0.1" max="4" step="0.05"
                    value={reviewCard.imageTransform.scale}
                    onChange={handleReviewTransform("scale")}
                  />
                </div>
                <button className="link-btn" onClick={handleReviewReset}>Reset</button>
              </div>
            </div>
          </div>

          <div className="bulk-review-nav">
            <button
              className="bulk-review-nav-btn"
              onClick={() => setReviewStep((s) => Math.max(0, s - 1))}
              disabled={reviewStep === 0}
            >
              ← Previous
            </button>
            {reviewStep < imageCardIndices.length - 1 ? (
              <button
                className="bulk-review-nav-btn bulk-review-nav-btn--primary"
                onClick={() => setReviewStep((s) => s + 1)}
              >
                Next →
              </button>
            ) : (
              <button
                className="bulk-review-nav-btn bulk-review-nav-btn--primary"
                onClick={() => setReviewMode(false)}
              >
                Done →
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── Results ── */}
      {cards.length > 0 && !reviewMode && (
        <section className="bulk-results">
          <div className="bulk-results-header">
            <span className="section-label">
              {cards.length} card{cards.length !== 1 ? "s" : ""}
              {imageCardIndices.length > 0 && (
                <span className="count-badge" style={{ marginLeft: 8 }}>
                  {imageCardIndices.length} with artwork
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {imageCardIndices.length > 0 && (
                <button
                  className="link-btn"
                  onClick={() => { setReviewStep(0); setReviewMode(true); }}
                >
                  Review images
                </button>
              )}
              <button
                className="bulk-download-btn"
                style={{ width: "auto", padding: "10px 20px", background: "var(--elevated)", color: "var(--text)", border: "1px solid var(--border)" }}
                onClick={() => setPrintOpen(true)}
              >
                ⎙ Print
              </button>
              <button
                className="download-btn bulk-download-btn"
                onClick={handleDownloadAll}
                disabled={downloading}
              >
                {downloading ? `Rendering… ${progress} / ${cards.length}` : "↓ Download All as ZIP"}
              </button>
            </div>
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

      {printOpen && (
        <PrintModal cards={cards} onClose={() => setPrintOpen(false)} />
      )}
    </div>
  );
}
