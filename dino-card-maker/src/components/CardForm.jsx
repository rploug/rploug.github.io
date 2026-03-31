import { useState } from "react";

const BASE = import.meta.env.BASE_URL;

const BONUS_OPTIONS = ["Nest", "Egg", "Predator", "Move", "Draw", "Claim", "Copy"];
const TYPES        = ["Predator", "Mother", "Defense", "Flying", "Water"];
const SIZES        = ["Tiny", "Small", "Medium", "Large", "Giant"];
const COSTS        = [0, 1, 2, "Basic", "Habitat"];
const PREFIXES     = ["Before Battle:", "After Battle:", "Special:", "Reaction:", "Ongoing:"];

// Art pane dimensions (must match CardPreview clip container)
const ART_W = 294;
const ART_H = 157;

// Compute the scale needed so a contained image covers the art pane.
function coverScale(naturalW, naturalH) {
  const r = naturalW / naturalH;
  const R = ART_W / ART_H;
  return r >= R
    ? (ART_H * r) / ART_W   // wider than pane: contained fits to width, scale up to fill height
    : ART_W / (ART_H * r);  // taller than pane: contained fits to height, scale up to fill width
}

// Max safe pan offsets so the image content never leaves the art pane.
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

export default function CardForm({
  name, setName,
  power, setPower,
  battleBonus, setBattleBonus,
  size, setSize,
  type, setType,
  cost, setCost,
  effects, setEffects,
  image, setImage,
  imageTransform, setImageTransform,
  onDownload,
  onPrint,
}) {
  const [effectPrefix, setEffectPrefix] = useState("");
  const [effectText, setEffectText] = useState("");
  const [naturalSize, setNaturalSize] = useState({ w: ART_W, h: ART_H });

  const addEffect = () => {
    if (!effectText.trim()) return;
    setEffects([...effects, { prefix: effectPrefix, text: effectText.trim() }]);
    setEffectText("");
    setEffectPrefix("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addEffect();
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target.result;
      const img = new window.Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        const initScale = Math.round(coverScale(w, h) * 100) / 100;
        setNaturalSize({ w, h });
        setImage(src);
        setImageTransform({ x: 0, y: 0, scale: initScale });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const { maxX, maxY } = maxOffsets(naturalSize.w, naturalSize.h, imageTransform.scale);

  const setT = (key) => (e) => {
    const val = Number(e.target.value);
    setImageTransform((t) => {
      const next = { ...t, [key]: val };
      if (key === "scale") {
        const { maxX: mX, maxY: mY } = maxOffsets(naturalSize.w, naturalSize.h, val);
        next.x = Math.max(-mX, Math.min(mX, t.x));
        next.y = Math.max(-mY, Math.min(mY, t.y));
      }
      return next;
    });
  };

  return (
    <aside className="sidebar">

      {/* ── Identity ── */}
      <section className="form-section">
        <h2 className="section-label">Identity</h2>
        <div className="row-fields">
          <div className="field">
            <label>Name</label>
            <input
              type="text"
              placeholder="Card name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Power</label>
            <input
              type="number"
              value={power}
              onChange={(e) => setPower(Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      {/* ── Appearance ── */}
      <section className="form-section">
        <h2 className="section-label">Appearance</h2>

        <div className="field">
          <label>Type</label>
          <div className="type-grid">
            {TYPES.map((t) => (
              <button
                key={t}
                className={`type-btn${type === t ? " active" : ""}`}
                onClick={() => setType(type === t ? "" : t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="row-fields">
          <div className="field">
            <label>Size</label>
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">—</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cost</label>
            <select value={cost} onChange={(e) => setCost(e.target.value)}>
              <option value="">—</option>
              {COSTS.map((c) => (
                <option key={c} value={c}>{c === "Habitat" ? "1 Habitat" : c}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Battle Bonuses ── */}
      <section className="form-section">
        <h2 className="section-label">
          Battle Bonuses
          <span className="count-badge">{battleBonus.length} / 3</span>
        </h2>

        <div className="bonus-grid">
          {BONUS_OPTIONS.map((opt) => (
            <button
              key={opt}
              className="bonus-btn"
              disabled={battleBonus.length >= 3}
              onClick={() => setBattleBonus([...battleBonus, opt])}
              title={opt}
            >
              <img src={`${BASE}bonus/${opt.toLowerCase()}.svg`} alt={opt} />
              {opt}
            </button>
          ))}
        </div>

        {battleBonus.length > 0 && (
          <div className="bonus-selected">
            <div className="bonus-selected-icons">
              {battleBonus.map((b, i) => (
                <span key={i} className="bonus-tag" title={b}>
                  <img src={`${BASE}bonus/${b.toLowerCase()}.svg`} alt={b} />
                </span>
              ))}
            </div>
            <button className="link-btn" onClick={() => setBattleBonus([])}>
              Clear
            </button>
          </div>
        )}
      </section>

      {/* ── Effects ── */}
      <section className="form-section">
        <h2 className="section-label">Effects</h2>

        <div className="field">
          <label>Prefix</label>
          <select value={effectPrefix} onChange={(e) => setEffectPrefix(e.target.value)}>
            <option value="">None</option>
            {PREFIXES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Text</label>
          <textarea
            placeholder="Describe the effect… (Ctrl+Enter to add)"
            value={effectText}
            onChange={(e) => setEffectText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
          />
        </div>

        <button className="add-btn" onClick={addEffect} disabled={!effectText.trim()}>
          + Add Effect
        </button>

        {effects.length > 0 && (
          <ul className="effects-list">
            {effects.map((ef, i) => (
              <li key={i}>
                <div className="effect-content">
                  {ef.prefix && ef.prefix !== "None" && (
                    <strong>{ef.prefix} </strong>
                  )}
                  {ef.text}
                </div>
                <button
                  className="remove-btn"
                  onClick={() => setEffects(effects.filter((_, idx) => idx !== i))}
                  title="Remove"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Artwork ── */}
      <section className="form-section">
        <h2 className="section-label">Artwork</h2>

        <label className="upload-label">
          {image ? "Change image" : "Upload image"}
          <input type="file" accept="image/*" onChange={handleImage} hidden />
        </label>

        {image && (
          <div className="artwork-preview">
            <img src={image} alt="preview" />
            <button className="link-btn" onClick={() => setImage(null)}>Remove</button>
          </div>
        )}

        {image && (
          <div className="image-transform">
            <div className="field">
              <label>X <span className="value-badge">{imageTransform.x}px</span></label>
              <input type="range" min={-maxX} max={maxX} value={imageTransform.x} onChange={setT("x")} disabled={maxX === 0} />
            </div>
            <div className="field">
              <label>Y <span className="value-badge">{imageTransform.y}px</span></label>
              <input type="range" min={-maxY} max={maxY} value={imageTransform.y} onChange={setT("y")} disabled={maxY === 0} />
            </div>
            <div className="field">
              <label>Scale <span className="value-badge">{imageTransform.scale.toFixed(2)}×</span></label>
              <input type="range" min="0.1" max="4" step="0.05" value={imageTransform.scale} onChange={setT("scale")} />
            </div>
            <button className="link-btn" onClick={() => {
              const initScale = Math.round(coverScale(naturalSize.w, naturalSize.h) * 100) / 100;
              setImageTransform({ x: 0, y: 0, scale: initScale });
            }}>
              Reset
            </button>
          </div>
        )}
      </section>

      {/* ── Export ── */}
      <section className="form-section">
        <button className="download-btn" onClick={onDownload}>
          ↓ Download Card
        </button>
        <button className="download-btn" style={{ marginTop: 8, background: "var(--elevated)", color: "var(--text)", border: "1px solid var(--border)" }} onClick={onPrint}>
          ⎙ Print Card
        </button>
      </section>

    </aside>
  );
}
