import { useState, useEffect } from "react";

const LED_COUNT = 60;

export default function NeoPixelSimulator() {
  const [pixels, setPixels] = useState(Array(LED_COUNT).fill([0, 0, 0]));
  const [t, setT] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setT((x) => x + 1);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updated = pixels.map((_, i) =>
      hsvToRgb(((i * 3 + t) % 360) / 360, 1, 1)
    );
    setPixels(updated);
  }, [t]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem", alignItems: "center" }}>
      <h1>NeoPixel Effect Simulator</h1>
      <div style={{ display: "flex", gap: "4px" }}>
        {pixels.map((rgb, i) => (
          <div
            key={i}
            style={{
              width: "16px",
              height: "16px",
              backgroundColor: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
            }}
          />
        ))}
      </div>
    </div>
  );
}

function hsvToRgb(h, s, v) {
  let r, g, b;
  let i = Math.floor(h * 6);
  let f = h * 6 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: (r = v), (g = t), (b = p); break;
    case 1: (r = q), (g = v), (b = p); break;
    case 2: (r = p), (g = v), (b = t); break;
    case 3: (r = p), (g = q), (b = v); break;
    case 4: (r = t), (g = p), (b = v); break;
    case 5: (r = v), (g = p), (b = q); break;
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
