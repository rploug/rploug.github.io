import { forwardRef } from "react";

const BASE = import.meta.env.BASE_URL;
const CARD_TYPES = ["Defense", "Water", "Flying", "Predator", "Mother"];

// All measurements preserved exactly from original project.
// Card display size: 300×417px | Export size: 756×1051px (scale 2.52)

function CardPreview(
  { name, power, battleBonus, size, type, cost, effects, image, imageTransform = { x: 0, y: 0, scale: 1 } },
  ref
) {
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "300px",
        height: "417px",
        fontFamily: "'Leander', sans-serif",
        overflow: "hidden",
        flexShrink: 0,
        isolation: "isolate",
      }}
    >
      {/* ── Type background layers (rendered below artwork) ── */}
      {CARD_TYPES.includes(type) && (
        <>
          <img
            src={`${BASE}${type.toLowerCase()}/${type.toLowerCase()}Top.svg`}
            alt=""
            style={{
              position: "absolute",
              top: "6px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "96%",
              pointerEvents: "none",
              zIndex: -1,
            }}
          />
          <img
            src={`${BASE}${type.toLowerCase()}/${type.toLowerCase()}Mid.svg`}
            alt=""
            style={{
              position: "absolute",
              top: "210px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "96%",
              pointerEvents: "none",
              zIndex: -1,
            }}
          />
          <img
            src={`${BASE}${type.toLowerCase()}/${type.toLowerCase()}Bot.svg`}
            alt=""
            style={{
              position: "absolute",
              bottom: "6.5px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "96%",
              pointerEvents: "none",
              zIndex: -1,
            }}
          />
        </>
      )}

      {/* ── Card artwork (clipped to art pane) ── */}
      {image && (
        <div
          style={{
            position: "absolute",
            top: "51px",
            left: "3px",
            width: "294px",
            height: "157px",
            overflow: "hidden",
            zIndex: -1,
          }}
        >
          <img
            src={image}
            alt=""
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transformOrigin: "center center",
              transform: `translate(calc(-50% + ${imageTransform.x}px), calc(-50% + ${imageTransform.y}px)) scale(${imageTransform.scale})`,
            }}
          />
        </div>
      )}

      {/* ── Outline overlay (always on top of art/type layers) ── */}
      <img
        src={`${BASE}outline.svg`}
        alt=""
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1000,
          pointerEvents: "none",
        }}
      />

      {/* ── Battle bonus icons (above outline) ── */}
      {battleBonus.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "185px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "6px",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1100,
          }}
        >
          {battleBonus.map((bonus, i) => (
            <img
              key={i}
              src={`${BASE}bonus/${bonus.toLowerCase()}.svg`}
              alt={bonus}
              style={{ width: "47px", height: "47px", objectFit: "contain" }}
            />
          ))}
        </div>
      )}

      {/* ── Name ── */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: "20px",
          fontSize: "18px",
          color: "white",
          textTransform: "uppercase",
        }}
      >
        {name}
      </div>

      {/* ── Power ── */}
      <div
        style={{
          position: "absolute",
          top: "5px",
          right: "28px",
          fontSize: "28px",
          color: "white",
          fontFamily: "'Roboto', sans-serif",
          fontWeight: 700,
          zIndex: 1100,
        }}
      >
        {power}
      </div>

      {/* ── Size + Type ── */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "20px",
          fontSize: "16px",
          color: "white",
          textTransform: "uppercase",
        }}
      >
        {size} {type}
      </div>

      {/* ── Cost ── */}
      <div
        style={{
          position: "absolute",
          bottom: cost === "Simple" ? "10px" : "8px",
          right: cost === "Simple" ? "20px" : "35px",
          fontSize: cost === "Simple" ? "16px" : "18px",
          color: "white",
          textTransform: cost === "Simple" ? "uppercase" : "none",
          fontFamily:
            cost === "Simple" ? "'Leander', sans-serif" : "'Roboto', sans-serif",
          fontWeight: 700,
        }}
      >
        {cost}
      </div>

      {/* ── Egg cost icon (numeric costs only) ── */}
      {cost !== "" && cost !== "Simple" && (
        <img
          src={`${BASE}egg.svg`}
          alt=""
          style={{
            position: "absolute",
            bottom: "14.75px",
            right: "14px",
            transform: "translateX(-50%)",
            width: "12px",
            pointerEvents: "none",
          }}
        />
      )}

      {/* ── Effects text ── */}
      {effects.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "73%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80%",
            fontSize: "18px",
            textAlign: "center",
            lineHeight: "1.1",
            color: "black",
            fontFamily: "'Roboto', sans-serif",
          }}
        >
          {effects.map((ef, i) => (
            <div key={i} style={{ marginBottom: "10px" }}>
              {ef.prefix && ef.prefix !== "None" && (
                <div style={{ fontWeight: 700 }}>
                  {ef.prefix.replace(":", "")}:
                </div>
              )}
              <div style={{ fontWeight: 400 }}>{ef.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default forwardRef(CardPreview);
