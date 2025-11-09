// ============= GLOBALS =============
const stripContainer = document.getElementById("stripContainer");
const runBtn = document.getElementById("runBtn");

// Registry of all strips the user creates
let allStrips = [];

// ============= GAMMA TABLE =============
const gammaTable = new Array(256).fill(0).map((_, i) =>
  Math.floor(Math.pow(i / 255, 2.6) * 255 + 0.5)
);

// ============= STRIP CLASS =============
class WebNeoPixel {
  constructor(numPixels, pin, type) {
    this.num = numPixels;
    this.pin = pin;
    this.type = type;
    this.brightness = 255;

    this.buffer = new Array(this.num).fill(0).map(() => ({
      r: 0, g: 0, b: 0, w: 0
    }));

    this.row = null;
    this.leds = [];
  }

  // Create DOM row for this strip
  attachToDOM(name = "") {
    this.row = document.createElement("div");
    this.row.classList.add("stripRow");

    const label = document.createElement("div");
    label.classList.add("stripLabel");
    label.textContent = name;
    this.row.appendChild(label);

    for (let i = 0; i < this.num; i++) {
      const led = document.createElement("div");
      led.classList.add("led");
      this.row.appendChild(led);
      this.leds.push(led);
    }

    stripContainer.appendChild(this.row);
  }

  begin() { /* compatibility */ }

  show() {
    for (let i = 0; i < this.num; i++) {
      const px = this.buffer[i];
      const br = this.brightness / 255;

      const r = px.r * br;
      const g = px.g * br;
      const b = px.b * br;

      this.leds[i].style.background = `rgb(${r},${g},${b})`;
    }
  }

  fill(color = 0, first = 0, count = 0) {
    if (count === 0) count = this.num - first;
    for (let i = first; i < first + count; i++) {
      this.setPixelColor(i, color);
    }
  }

  clear() {
    this.fill(0);
  }

  setPixelColor(i, r, g, b, w) {
    if (typeof r === "number" && g === undefined) {
      this.buffer[i] = this.unpackColor(r);
      return;
    }
    this.buffer[i] = { r, g, b, w: w || 0 };
  }

  getPixelColor(i) {
    const px = this.buffer[i];
    return (px.w << 24) | (px.r << 16) | (px.g << 8) | px.b;
  }

  numPixels() {
    return this.num;
  }

  setBrightness(b) {
    this.brightness = Math.max(0, Math.min(255, b));
  }

  getBrightness() {
    return this.brightness;
  }

  Color(r, g, b, w = 0) {
    return (w << 24) | (r << 16) | (g << 8) | b;
  }

  unpackColor(c) {
    return {
      w: (c >> 24) & 255,
      r: (c >> 16) & 255,
      g: (c >> 8) & 255,
      b: (c) & 255
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
      default: r=v; g=p; b=q;
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

// ========== GLOBAL HELPERS ==========
function newStrip(numPixels, pin, type = "GRB") {
  const strip = new WebNeoPixel(numPixels, pin, type);
  allStrips.push(strip);
  strip.attachToDOM(`Pin ${pin}`);
  return strip;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// =========== RUN BUTTON ===========
runBtn.onclick = async () => {
  stripContainer.innerHTML = "";
  allStrips = [];

  let code = document.getElementById("codeInput").value;

  // ✅ Apply Arduino preprocessing BEFORE execution
  code = preprocessArduinoCode(code);

  // Prepare sandbox: inject newStrip, delay
  const sandbox = new Function(
    "newStrip", "delay",
    `"use strict"; 
     ${code}
     if (typeof setup === 'function') await setup();
     if (typeof loop === 'function') while(true) await loop();
    `
  );

  sandbox(newStrip, delay);
};

function preprocessArduinoCode(code) {
  // Remove ALL preprocessor lines (#include, #define, #pragma, etc.)
  code = code.replace(/^\s*#.*$/gm, "");

  // Replace NEO_* constants
  code = code.replace(/\bNEO_GRB\b/g, `"GRB"`);
  code = code.replace(/\bNEO_RGB\b/g, `"RGB"`);
  code = code.replace(/\bNEO_RGBW\b/g, `"RGBW"`);
  code = code.replace(/\bNEO_BRG\b/g, `"BRG"`);
  code = code.replace(/\bNEO_GBR\b/g, `"GBR"`);
  code = code.replace(/\bNEO_BGR\b/g, `"BGR"`);

  // Replace Adafruit_NeoPixel constructors
  code = code.replace(
    /Adafruit_NeoPixel\s+(\w+)\s*=\s*Adafruit_NeoPixel\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*([^)]+)\);/g,
    `let $1 = newStrip($2, $3, $4);`
  );
  code = code.replace(
    /Adafruit_NeoPixel\s+(\w+)\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*([^)]+)\);/g,
    `let $1 = newStrip($2, $3, $4);`
  );

  // Convert delay() → await delay()
  code = code.replace(/\bdelay\s*\(/g, "await delay(");

  // Convert void setup()/loop()
  code = code.replace(/void\s+setup\s*\(\s*\)/, "async function setup()");
  code = code.replace(/void\s+loop\s*\(\s*\)/, "async function loop()");

  return code;
}

