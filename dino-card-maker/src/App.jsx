import { useState, useRef, useEffect } from "react";
import domtoimage from "dom-to-image-more";
import CardPreview from "./components/CardPreview";
import CardForm from "./components/CardForm";

function App() {
  const [theme, setTheme] = useState("light");
  const [name, setName] = useState("");
  const [power, setPower] = useState(0);
  const [battleBonus, setBattleBonus] = useState([]);
  const [size, setSize] = useState("");
  const [type, setType] = useState("");
  const [cost, setCost] = useState("");
  const [effects, setEffects] = useState([]);
  const [image, setImage] = useState(null);
  const [imageTransform, setImageTransform] = useState({ x: 0, y: 0, scale: 1 });

  const cardRef = useRef();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleDownload = () => {
    if (!cardRef.current) return;
    domtoimage
      .toPng(cardRef.current, {
        width: 756,
        height: 1051,
        style: {
          transform: "scale(2.52)",
          transformOrigin: "top left",
          width: "300px",
          height: "417px",
        },
      })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `${name || "card"}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch(console.error);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Dino Card Creator</h1>
        <button
          className="theme-toggle"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          {theme === "light" ? "☾" : "☀"}
        </button>
      </header>

      <div className="app-body">
        <CardForm
          name={name} setName={setName}
          power={power} setPower={setPower}
          battleBonus={battleBonus} setBattleBonus={setBattleBonus}
          size={size} setSize={setSize}
          type={type} setType={setType}
          cost={cost} setCost={setCost}
          effects={effects} setEffects={setEffects}
          image={image} setImage={setImage}
          imageTransform={imageTransform} setImageTransform={setImageTransform}
          onDownload={handleDownload}
        />

        <main className="app-main">
          <div className="card-stage">
            <span className="card-stage-label">Preview</span>
            <div className="card-shadow">
              <CardPreview
                ref={cardRef}
                name={name}
                power={power}
                battleBonus={battleBonus}
                size={size}
                type={type}
                cost={cost}
                effects={effects}
                image={image}
                imageTransform={imageTransform}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
