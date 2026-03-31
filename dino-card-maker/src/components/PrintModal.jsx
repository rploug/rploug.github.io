import { useState, useRef } from "react";
import domtoimage from "dom-to-image-more";
import CardPreview from "./CardPreview";

const CARD_RATIO    = 417 / 300;   // height / width of the card
const PAGE_MARGIN   = 10;          // mm — @page margin
const A4_SHORT      = 210 - 2 * PAGE_MARGIN;  // 190 mm
const A4_LONG       = 297 - 2 * PAGE_MARGIN;  // 277 mm
const GAP           = 3;           // mm gap between cards
const DEFAULT_WIDTH = 63.5;        // standard poker card width in mm

function calcGrid(pageW, pageH, cardW, cardH, gap) {
  const perRow = Math.max(1, Math.floor((pageW + gap) / (cardW + gap)));
  const perCol = Math.max(1, Math.floor((pageH + gap) / (cardH + gap)));
  return { perRow, perCol, count: perRow * perCol };
}

export default function PrintModal({ cards, onClose }) {
  const [cardWidthMm, setCardWidthMm]   = useState(DEFAULT_WIDTH);
  const [copiesPerCard, setCopiesPerCard] = useState(1);
  const [noGap, setNoGap]               = useState(false);
  const [rendering, setRendering]       = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const captureRefs = useRef([]);

  const cardHeightMm = +(cardWidthMm * CARD_RATIO).toFixed(2);
  const gap = noGap ? 0 : GAP;

  // Cards are rotated 90° on a portrait A4 page — use the flipped card dimensions for layout
  const { perRow: cardsPerRow, perCol: cardsPerCol } =
    calcGrid(A4_SHORT, A4_LONG, cardHeightMm, cardWidthMm, gap);

  const cardsPerPage = cardsPerRow * cardsPerCol;
  const totalCards   = cards.length * copiesPerCard;
  const totalPages   = Math.ceil(totalCards / cardsPerPage);

  const handlePrint = async () => {
    setRendering(true);
    setRenderProgress(0);

    // Render each unique card to a PNG data URL
    const cardImages = [];
    for (let i = 0; i < cards.length; i++) {
      const el = captureRefs.current[i];
      try {
        const dataUrl = await domtoimage.toPng(el, {
          width: 756, height: 1051,
          style: { transform: "scale(2.52)", transformOrigin: "top left", width: "300px", height: "417px" },
        });
        cardImages.push(dataUrl);
      } catch (err) {
        console.error(`Card ${i} render failed:`, err);
        cardImages.push(null);
      }
      setRenderProgress(i + 1);
    }

    // Expand copies
    const allImages = [];
    for (let i = 0; i < cardImages.length; i++) {
      for (let c = 0; c < copiesPerCard; c++) {
        allImages.push(cardImages[i]);
      }
    }

    // Split into pages
    const pages = [];
    for (let p = 0; p < totalPages; p++) {
      pages.push(allImages.slice(p * cardsPerPage, (p + 1) * cardsPerPage));
    }

    const w = cardWidthMm.toFixed(2);
    const h = cardHeightMm.toFixed(2);

    const pagesHtml = pages.map((srcs) => {
      const cells = srcs
        .map((src) => `<div class="card">${src ? `<img src="${src}" />` : ""}</div>`)
        .join("");
      return `<div class="page"><div class="grid">${cells}</div></div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Dino Cards — Print</title>
<style>
  @page { size: A4 portrait; margin: ${PAGE_MARGIN}mm; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: white; }
  .page {
    width: ${A4_SHORT}mm;
    height: ${A4_LONG}mm;
    display: flex;
    align-items: center;
    justify-content: center;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }
  .grid {
    display: grid;
    grid-template-columns: repeat(${cardsPerRow}, ${h}mm);
    grid-template-rows: repeat(${cardsPerCol}, ${w}mm);
    gap: ${gap}mm;
  }
  /* Cell is landscape (h×w); image is portrait (w×h) rotated 90° to fill it */
  .card { width: ${h}mm; height: ${w}mm; overflow: hidden; position: relative; }
  .card img {
    width: ${w}mm; height: ${h}mm;
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(90deg);
    display: block;
  }
  @media screen { body { padding: 10mm; background: #eee; } .page { background: white; margin: 0 auto 10mm; } }
</style>
</head>
<body>
${pagesHtml}
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));<\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, "_blank");
    if (!win) alert("Please allow pop-ups to open the print window.");
    setTimeout(() => URL.revokeObjectURL(url), 30000);

    setRendering(false);
    setRenderProgress(0);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <h2 className="section-label">Print Cards</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">

          {/* Size slider */}
          <div className="field">
            <label>
              Card width
              <span className="value-badge" style={{ marginLeft: 6 }}>{cardWidthMm.toFixed(1)} mm</span>
            </label>
            <input
              type="range" min="40" max="100" step="0.5"
              value={cardWidthMm}
              onChange={(e) => setCardWidthMm(Number(e.target.value))}
            />
          </div>

          {/* W × H numeric inputs */}
          <div className="print-dimensions">
            <div className="field">
              <label>W (mm)</label>
              <input
                type="number" min="40" max="100" step="0.5"
                value={cardWidthMm}
                onChange={(e) => setCardWidthMm(Math.min(100, Math.max(40, Number(e.target.value))))}
              />
            </div>
            <span className="print-dimensions-sep">×</span>
            <div className="field">
              <label>H (mm)</label>
              <input type="number" readOnly value={cardHeightMm.toFixed(1)} />
            </div>
          </div>

          {/* Gap toggle */}
          <label className="print-gap-toggle">
            <input type="checkbox" checked={noGap} onChange={(e) => setNoGap(e.target.checked)} />
            No gap between cards
            <span className="print-gap-hint">easier to cut in one straight line</span>
          </label>

          {/* Copies */}
          <div className="field">
            <label>Copies per card</label>
            <input
              type="number" min="1" max="99"
              value={copiesPerCard}
              onChange={(e) =>
                setCopiesPerCard(Math.max(1, Math.min(99, Math.floor(Number(e.target.value)))))
              }
            />
          </div>

          {/* Layout info */}
          <div className="print-info">
            <span>{cardsPerRow} × {cardsPerCol} per page</span>
            <span className="count-badge">Portrait A4</span>
            <span className="count-badge">{totalCards} card{totalCards !== 1 ? "s" : ""}</span>
            <span className="count-badge">{totalPages} page{totalPages !== 1 ? "s" : ""}</span>
          </div>

        </div>

        <div className="modal-footer">
          <button className="link-btn" onClick={onClose}>Cancel</button>
          <button
            className="download-btn"
            style={{ width: "auto", padding: "10px 24px" }}
            onClick={handlePrint}
            disabled={rendering}
          >
            {rendering ? `Rendering… ${renderProgress} / ${cards.length}` : "Print"}
          </button>
        </div>

        {/* Hidden full-size cards for dom-to-image capture */}
        <div style={{ position: "fixed", left: -9999, top: 0, opacity: 0, pointerEvents: "none" }}>
          {cards.map((card, i) => (
            <CardPreview
              key={i}
              ref={(el) => { captureRefs.current[i] = el; }}
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

      </div>
    </div>
  );
}
