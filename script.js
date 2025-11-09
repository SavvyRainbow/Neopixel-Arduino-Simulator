const stripContainer = document.getElementById("stripContainer");
const runBtn = document.getElementById("runBtn");

let allStrips = [];

// -------------------------
//  NeoPixel Simulation
// -------------------------
class WebNeoPixel {
  constructor(numPixels, pin, type = "GRB") {
    this.num = numPixels;
    this.pin = pin;
    this.type = type;
    this.brightness = 255;
    this.buffer = Array(numPixels).fill().map(() => ({ r:0, g:0, b:0, w:0 }));
    this.leds = [];
  }

  attachToDOM(labelText = "") {
    const row = document.createElement("div");
    row.classList.add("stripRow");

    const label = document.createElement("div");
    label.classList.add("stripLabel");
    label.textContent = labelText;
    row.appendChild(label);

    for (let i = 0; i < this.num; i++) {
      const led = document.createElement("div");
      led.classList.add("led");
      row.appendChild(led);
      this.leds.push(led);
    }
    stripContainer.appendChild(row);
  }

  begin() {}

  show() {
    const br = this.brightness / 255;
    for (let i = 0; i < this.num; i++) {
      const px = this.buffer[i];
      this.leds[i].style.background = `rgb(${px.r * br}, ${px.g * br}, ${px.b * br})`;
    }
  }

  setBrightness(b) {
    this.brightness = Math.max(0, Math.min(255, b));
  }

  fill(color = 0, first = 0, count = 0) {
    if (count === 0) count = this.num - first;
    for (let i = first; i < first + count; i++) this.setPixelColor(i, color);
  }

  clear() { this.fill(0); }

  setPixelColor(i, r, g, b, w = 0) {
    if (g === undefined) {  
      this.buffer[i] = this.unpackColor(r);
      return;
    }
    this.buffer[i] = { r:r||0, g:g||0, b:b||0, w:w||0 };
  }

  Color(r, g, b, w = 0) { return (w<<24)|(r<<16)|(g<<8)|b; }

  unpackColor(c) {
    return {
      w: (c >> 24) & 255,
      r: (c >> 16) & 255,
      g: (c >> 8) & 255,
      b: c & 255
    };
  }
}

// -------------------------
//   Button Simulation
// -------------------------
class WebButton {
  constructor(label) {
    this.callback = null;
    this.elem = document.createElement("button");
    this.elem.textContent = label;
    this.elem.classList.add("simButton");

    this.elem.onclick = () => {
      if (this.callback) this.callback();
    };

    stripContainer.appendChild(this.elem);
  }

  onClick(cb) { this.callback = cb; }
}

// -------------------------
//  API Exposed to Arduino Code
// -------------------------
function newStrip(numPixels, pin, type="GRB") {
  const strip = new WebNeoPixel(numPixels, pin, type);
  allStrips.push(strip);
  strip.attachToDOM(`Pin ${pin}`);
  return strip;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -------------------------
//  Preprocess Arduino-style Code
// -------------------------
function preprocessArduinoCode(code) {
  // Remove #include lines
  code = code.replace(/^\s*#.*$/gm, "");

  // Replace NeoPixel type constants NEO_GRB → "GRB"
  code = code.replace(/\bNEO_([A-Z]+)\b/g, (m, t) => `"${t}"`);

  // Constructor: Adafruit_NeoPixel strip(10,6,"GRB");
  code = code.replace(
    /Adafruit_NeoPixel\s+(\w+)\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*"([A-Z]+)"\s*\)\s*;/gi,
    (m, name, count, pin, type) => `let ${name} = newStrip(${count}, ${pin}, "${type}");`
  );

  // Constructor: Adafruit_NeoPixel strip = Adafruit_NeoPixel(...);
  code = code.replace(
    /Adafruit_NeoPixel\s+(\w+)\s*=\s*Adafruit_NeoPixel\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*"([A-Z]+)"\s*\)\s*;/gi,
    (m, name, count, pin, type) => `let ${name} = newStrip(${count}, ${pin}, "${type}");`
  );

  // Button btn = new Button("Click Me");
  code = code.replace(
    /Button\s+(\w+)\s*=\s*new\s+Button\s*\("([^"]+)"\)\s*;/g,
    `let $1 = new WebButton("$2");`
  );

  // Smart delay() → await delay()
  code = code.replace(/(?<!await\s)\bdelay\s*\(/g, "await delay(");

  // Convert ALL setup() forms
  code = code.replace(/async\s+function\s+setup\s*\(/g, "setup = async (");
  code = code.replace(/void\s+setup\s*\(\s*\)/g, "setup = async ()");

  // Convert ALL loop() forms
  code = code.replace(/async\s+function\s+loop\s*\(/g, "loop = async (");
  code = code.replace(/void\s+loop\s*\(\s*\)/g, "loop = async ()");

  return code;
}

// -------------------------
//      EXECUTION WRAPPER
// -------------------------
runBtn.onclick = async () => {
  stripContainer.innerHTML = "";
  allStrips = [];

  let code = document.getElementById("codeInput").value;
  code = preprocessArduinoCode(code);

  // Debug output
  console.log("----- PROCESSED CODE -----\n" + code);

  try {
    // Wrap entire user program in one async function
    const wrapped = `
      let setup = async ()=>{};
      let loop  = async ()=>{};

      ${code}

      await setup();
      while(true) await loop();
    `;

    await (async () => { eval(wrapped); })();

  } catch (err) {
    console.error("Simulation error:", err);
  }
};
