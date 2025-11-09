const stripContainer = document.getElementById("stripContainer");
const runBtn = document.getElementById("runBtn");

let allStrips = [];

/* -----------------------------------------
   NeoPixel Simulation
------------------------------------------ */
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

  setBrightness(b) { this.brightness = Math.max(0, Math.min(255, b)); }
  fill(color = 0, first = 0, count = 0) {
    if(count === 0) count = this.num - first;
    for(let i = first; i < first + count; i++) this.setPixelColor(i, color);
  }
  clear() { this.fill(0); }
  setPixelColor(i, r, g, b, w = 0) {
    if(g === undefined) {
      this.buffer[i] = this.unpackColor(r);
      return;
    }
    this.buffer[i] = { r:r||0, g:g||0, b:b||0, w:w||0 };
  }
  Color(r,g,b,w=0) { return (w<<24)|(r<<16)|(g<<8)|b; }
  unpackColor(c) {
    return { w:(c>>24)&255, r:(c>>16)&255, g:(c>>8)&255, b:c&255 };
  }
}

/* -----------------------------------------
   Button Simulation
------------------------------------------ */
class WebButton {
  constructor(label) {
    this.callback = null;
    this.elem = document.createElement("button");
    this.elem.textContent = label;
    this.elem.classList.add("simButton");

    this.elem.onclick = () => { if(this.callback) this.callback(); };
    stripContainer.appendChild(this.elem);
  }

  onClick(cb) { this.callback = cb; }
}

/* -----------------------------------------
   Exposed API
------------------------------------------ */
function newStrip(numPixels, pin, type="GRB") {
  const strip = new WebNeoPixel(numPixels, pin, type);
  allStrips.push(strip);
  strip.attachToDOM(`Pin ${pin}`);
  return strip;
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/* -----------------------------------------
   Arduino → JavaScript Preprocessor
------------------------------------------ */
function preprocessArduinoCode(code) {

  // Remove #include lines
  code = code.replace(/^\s*#.*$/gm, "");

  // Replace NeoPixel constants
  code = code.replace(/\bNEO_([A-Z]+)\b/g, (m,t)=> `"${t}"`);
  code = code.replace(/\+?\s*NEO_KHZ\d+/g,""); // remove timing constants

  // Replace C++ types
  code = code.replace(/\b(int|long|byte|char)\b/g,"let");

  // Replace Adafruit_NeoPixel initialization
  code = code.replace(/Adafruit_NeoPixel\s+(\w+)\s*\(\s*([^)]+)\s*\)\s*;/g,
    (m,name,args)=> `let ${name} = newStrip(${args.split(",").map(a=>a.trim()).slice(0,3).join(",")});`);

  code = code.replace(/Button\s+(\w+)\s*=\s*new\s+Button\s*\("([^"]+)"\)\s*;/g,
    `let $1 = new WebButton("$2");`);

  // Replace delay with await delay
  code = code.replace(/(?<!await\s)\bdelay\s*\(/g,"await delay(");

  // Convert setup/loop to async arrow functions
  code = code.replace(/async\s+function\s+setup\s*\(\s*\)\s*\{/g,"setup = async () => {");
  code = code.replace(/void\s+setup\s*\(\s*\)\s*\{/g,"setup = async () => {");
  code = code.replace(/async\s+function\s+loop\s*\(\s*\)\s*\{/g,"loop = async () => {");
  code = code.replace(/void\s+loop\s*\(\s*\)\s*\{/g,"loop = async () => {");

  return code;
}

/* -----------------------------------------
   Main Execution Handler
------------------------------------------ */
runBtn.onclick = () => {
  stripContainer.innerHTML = "";
  allStrips = [];

  let code = document.getElementById("codeInput").value;
  code = preprocessArduinoCode(code);

  console.log("----- PROCESSED CODE -----\n" + code);

  try {
    // Wrap user code in async IIFE inside eval
    eval(`(async () => {
      ${code}
      await setup();
      while(true) await loop();
    })()`);
  } catch (err) {
    console.error("Simulation error:", err);
  }
};

/* -----------------------------------------
   Example helper function (CylonBounce)
------------------------------------------ */
async function CylonBounce(red, green, blue, EyeSize, NumLoops, SpeedDelay) {
  for (let loop = 0; loop < NumLoops; loop++) {
    for (let i = 0; i < BLADE_NUM_LEDS - EyeSize - 2; i++) {
      for (let j = 0; j < BLADE_NUM_LEDS; j++) {
        bladeStrip.setPixelColor(j, 0, 100, 0);
      }
      bladeStrip.show();
      bladeStrip.setPixelColor(i, red/10, green/10, blue/10);
      for (let j = 1; j <= EyeSize; j++) {
        bladeStrip.setPixelColor(i+j, red, green, blue);
      }
      bladeStrip.setPixelColor(i+EyeSize+1, red/10, green/10, blue/10);
      bladeStrip.show();
      await delay(SpeedDelay);
    }
  }
}
