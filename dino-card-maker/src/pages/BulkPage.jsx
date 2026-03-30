import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import domtoimage from "dom-to-image-more";
import CardPreview from "../components/CardPreview";

const VALID_TYPES    = ["Predator", "Mother", "Defense", "Flying", "Water"];
const VALID_SIZES    = ["Tiny", "Small", "Medium", "Large", "Giant"];
const VALID_COSTS    = ["0", "1", "2", "Simple"];
const VALID_BONUSES  = ["Nest", "Egg", "Predator", "Move", "Draw", "Claim", "Copy"];
const PREFIXES       = ["Before Battle:", "After Battle:", "Special:", "Reaction:", "Ongoing:"];

function parseEffects(raw) {
  if (!raw && raw !== 0) return [];
  return String(raw)
    .split("|")
    .map((e) => {
      const t = e.trim();
      const prefix = PREFIXES.find((p) => t.startsWith(p));
      return prefix
        ? { prefix, text: t.slice(prefix.length).trim() }
        : { prefix: "", text: t };
    })
    .filter((e) => e.text);
}

function parseBattleBonus(raw) {
  if (!raw && raw !== 0) return [];
  return String(raw)
    .split("|")
    .map((s) => {
      const trimmed = s.trim();
      return VALID_BONUSES.find((b) => b.toLowerCase() === trimmed.toLowerCase()) || trimmed;
    })
    .filter(Boolean)
    .slice(0, 3);
}

function parseRow(row) {
  const typeRaw = String(row.type || "").trim();
  const sizeRaw = String(row.size || "").trim();
  const costRaw = row.cost !== undefined && row.cost !== null ? String(row.cost).trim() : "";

  return {
    name: String(row.name || ""),
    power: Number(row.power) || 0,
    type: VALID_TYPES.find((t) => t.toLowerCase() === typeRaw.toLowerCase()) || "",
    size: VALID_SIZES.find((s) => s.toLowerCase() === sizeRaw.toLowerCase()) || "",
    cost: VALID_COSTS.find((c) => c.toLowerCase() === costRaw.toLowerCase()) || "",
    battleBonus: parseBattleBonus(row.battleBonus || row.battle_bonus || ""),
    effects: parseEffects(row.effects || ""),
    image: null,
    imageTransform: { x: 0, y: 0, scale: 1 },
  };
}

const CSV_EXAMPLE = `name,power,type,size,cost,battleBonus,effects
T-Rex,8,Predator,Giant,2,Predator|Egg,Before Battle: Gain 2 power|Ongoing: Cannot be blocked
Raptor,5,Predator,Small,1,Move,
Stegosaurus,4,Defense,Large,1,,Ongoing: Reduce incoming damage by 1
Pterodactyl,6,Flying,Medium,2,Draw|Claim,Special: Fly over all Ground dinosaurs
Baby Dino,2,Mother,Tiny,Simple,,`;

export default function BulkPage() {
  const [cards, setCards]         = useState([]);
  const [error, setError]         = useState("");
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const cardRefs = useRef([]);

  const handleFile = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const workbook = XLSX.read(ev.target.result, { type: "array" });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (rows.length === 0) {
          setError("No data rows found. Make sure the first row contains column headers.");
          return;
        }
        setCards(rows.map(parseRow));
      } catch (err) {
        setError("Failed to parse file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDownloadAll = async () => {
    if (cards.length === 0) return;
    setDownloading(true);
    setProgress(0);

    const zip = new JSZip();

    for (let i = 0; i < cards.length; i++) {
      const el = cardRefs.current[i];
      if (!el) continue;
      try {
        const dataUrl = await domtoimage.toPng(el, {
          width: 756,
          height: 1051,
          style: {
            transform: "scale(2.52)",
            transformOrigin: "top left",
            width: "300px",
            height: "417px",
          },
        });
        const base64   = dataUrl.split(",")[1];
        const filename = `${cards[i].name || `card-${i + 1}`}.png`;
        zip.file(filename, base64, { base64: true });
      } catch (err) {
        console.error(`Card ${i} render failed:`, err);
      }
      setProgress(i + 1);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "dino-cards.zip";
    a.click();
    URL.revokeObjectURL(url);

    setDownloading(false);
    setProgress(0);
  };

  return (
    <div className="bulk-page">

      {/* ── Format docs ── */}
      <section className="bulk-docs">
        <h2 className="section-label">CSV / Excel Format</h2>
        <p className="bulk-docs-intro">
          Upload a <strong>.csv</strong> or <strong>.xlsx</strong> file with one card per row.
          The first row must be a header with the column names listed below.
        </p>

        <div className="bulk-table-wrap">
          <table className="bulk-schema-table">
            <thead>
              <tr>
                <th>Column</th>
                <th>Accepted values</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>name</code></td>
                <td>Any text</td>
                <td>Card name</td>
              </tr>
              <tr>
                <td><code>power</code></td>
                <td>Number — e.g. <code>5</code></td>
                <td>Power value shown in top-right</td>
              </tr>
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
              <tr>
                <td><code>cost</code></td>
                <td><code>0</code> · <code>1</code> · <code>2</code> · <code>Simple</code></td>
                <td>Leave blank to omit</td>
              </tr>
              <tr>
                <td><code>battleBonus</code></td>
                <td>Pipe-separated — e.g. <code>Move|Draw</code></td>
                <td>
                  Max 3 values from:{" "}
                  <code>Nest</code> <code>Egg</code> <code>Predator</code>{" "}
                  <code>Move</code> <code>Draw</code> <code>Claim</code> <code>Copy</code>
                </td>
              </tr>
              <tr>
                <td><code>effects</code></td>
                <td>Pipe-separated — e.g. <code>Ongoing: text|Special: text</code></td>
                <td>
                  Optional prefix from:{" "}
                  <code>Before Battle:</code> <code>After Battle:</code> <code>Special:</code>{" "}
                  <code>Reaction:</code> <code>Ongoing:</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bulk-docs-example-header">
          <p className="bulk-docs-example-label">Example CSV</p>
          <a
            href={`${import.meta.env.BASE_URL}example-cards.csv`}
            download="example-cards.csv"
            className="bulk-example-download"
          >
            ↓ Download example file
          </a>
        </div>
        <pre className="bulk-csv-example">{CSV_EXAMPLE}</pre>
      </section>

      {/* ── Upload ── */}
      <section className="bulk-upload-section">
        <label className="upload-label">
          {cards.length > 0
            ? `Replace file  (${cards.length} card${cards.length !== 1 ? "s" : ""} loaded)`
            : "Upload CSV or Excel file (.csv · .xlsx)"}
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} hidden />
        </label>
        {error && <p className="bulk-error">{error}</p>}
      </section>

      {/* ── Results ── */}
      {cards.length > 0 && (
        <section className="bulk-results">
          <div className="bulk-results-header">
            <span className="section-label">
              {cards.length} card{cards.length !== 1 ? "s" : ""}
            </span>
            <button
              className="download-btn bulk-download-btn"
              onClick={handleDownloadAll}
              disabled={downloading}
            >
              {downloading
                ? `Rendering… ${progress} / ${cards.length}`
                : "↓ Download All as ZIP"}
            </button>
          </div>

          {/* Hidden full-size cards for capture — off-screen but in DOM */}
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

          {/* Visible scaled previews */}
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
