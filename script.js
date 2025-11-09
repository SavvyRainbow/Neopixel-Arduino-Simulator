const LED_COUNT = 60;  // Change strip length as needed

// Gamma table for gamma8()
const gammaTable = new Array(256).fill(0).map((_, i) =>
  Math.floor(Math.pow(i / 255, 2.6) * 255 + 0.5)
);

// ==========================
//    NeoPixel Strip Class
// ==========================
class WebNeoPixel {
  constructor(numPixels, pin, type = "GRB") {
    this.num = numPixels;
    this.type = type.includes("RGBW") ? "RGBW" : "RGB";
    this.brightness = 255;

    this.buffer = new Array(this.num).fill(0).map(() => ({
      r: 0,
      g: 0,
      b: 0,
      w: 0
    }));
  }

  begin() { /* kept for API compatibility */ }

  show() {
    for (let i = 0; i < this.num; i++) {
      const led = this.dom[i];
      const px = this.buffer[i];

      const br = this.brightness / 255;

      let r = px.r * br;
      let g = px.g * br;
      let b = px.b * br;

      led.style.background = `rgb(${r},${g},${b})`;
    }
  }

  setBrightness(b) {
    this.brightness = Math.max(0, Math.min(255, b));
  }

  getBrightness() {
    return this.brightness;
  }

  numPixels() {
    return this.num;
  }

  clear() {
    this.fill(0);
  }

  fill(color = 0, first = 0, count = 0) {
    if (count === 0) count = this.num - first;
    for (let i = first; i < first + count; i++) {
      this.setPixelColor(i, color);
    }
  }

  setPixelColor(i, r, g, b, w) {
    if (typeof r === "number" && g === undefined) {
      const c = this.unpackColor(r);
      this.buffer[i] = c;
      return;
    }

    this.buffer[i] = {
      r: r || 0,
      g: g || 0,
      b: b || 0,
      w: w || 0
    };
  }

  getPixelColor(i) {
    const px = this.buffer[i];
    return (
      (px.w << 24) |
      (px.r << 16) |
      (px.g << 8) |
      (px.b)
    );
  }

  Color(r, g, b, w = 0) {
    return (w << 24) | (r << 16) | (g << 8) | b;
  }

  unpackColor(c) {
    return {
      w: (c >> 24) & 255,
      r: (c >> 16) & 255,
      g: (c >> 8) & 255,
      b: c & 255
    };
  }

  ColorHSV(h, s = 255, v = 255) {
    h = h % 65536;
    let region = Math.floor(h / 10923);
    let f = (h % 10923) / 10923;

    let p = v * (1 - s / 255);
    let q = v * (1 - f * s / 255);
    let t = v * (1 - (1 - f) * s / 255);

    let r, g, b;

    switch (region) {
      case 0: r=v; g=t; b=p; break;
      case 1: r=q; g=v; b=p; break;
      case 2: r=p; g=v; b=t; break;
      case 3: r=p; g=q; b=v; break;
      case 4: r=t; g=p; b=v; break;
      case 5: r=v; g=p; b=q; break;
    }

    return this.Color(r, g, b);
  }

  gamma8(x) {
    return gammaTable[x];
  }

  gamma32(c) {
    const px = this.unpackColor(c);
    return this.Color(
      this.gamma8(px.r),
      this.gamma8(px.g),
      this.gamma8(px.b),
      this.gamma8(px.w)
    );
  }

  Wheel(pos) {
    pos = 255 - pos;
    if (pos < 85) return this.Color(255 - pos * 3, 0, pos * 3);
    if (pos < 170) {
      pos -= 85;
      return this.Color(0, pos * 3, 255 - pos * 3);
    }
    pos -= 170;
    return this.Color(pos * 3, 255 - pos * 3, 0);
  }
}

// ===========================
//   DOM + Interpreter Setup
// ===========================
const strip = document.getElementById("ledStrip");
const runBtn = document.getElementById("runBtn");

let neo = new WebNeoPixel(LED_COUNT, 6, "GRB");

function setupStripDOM() {
  strip.innerHTML = "";
  neo.dom = [];
  for (let i = 0; i < neo.num; i++) {
    const led = document.createElement("div");
    led.classList.add("led");
    strip.appendChild(led);
    neo.dom.push(led);
  }
}

// Simulated Arduino delay()
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runBtn.onclick = async () => {
  setupStripDOM();

  const userCode = document.getElementById("codeInput").value;

  const sandbox = new Function(
    "strip", "delay",
    `"use strict"; return (async () => { ${userCode} })()`
  );

  sandbox(neo, delay);
};

setupStripDOM();
