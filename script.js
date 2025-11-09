// ================= GLOBALS =================
const stripContainer = document.getElementById("stripContainer");
const runBtn = document.getElementById("runBtn");

// Registry for all user-created strips
let allStrips = [];

// ================= GAMMA TABLE =================
const gammaTable = new Array(256).fill(0).map((_, i) =>
  Math.floor(Math.pow(i / 255, 2.6) * 255 + 0.5)
);

// ================= NEOPIXEL STRIP CLASS =================
class WebNeoPixel {
  constructor(numPixels, pin, type = "GRB") {
    this.num = numPixels;
    this.pin = pin;
    this.type = type;
    this.brightness = 255;
    this.buffer = new Array(this.num).fill(0).map(() => ({ r:0,g:0,b:0,w:0 }));
    this.row = null;
    this.leds = [];
  }

  attachToDOM(name = "") {
    this.row = document.createElement("div");
    this.row.classList.add("stripRow");

    const label = document.createElement("div");
    label.classList.add("stripLabel");
    label.textContent = name;
    this.row.appendChild(label);

    for(let i=0;i<this.num;i++){
      const led = document.createElement("div");
      led.classList.add("led");
      this.row.appendChild(led);
      this.leds.push(led);
    }

    stripContainer.appendChild(this.row);
  }

  begin() {}

  show() {
    const br = this.brightness/255;
    for(let i=0;i<this.num;i++){
      const px = this.buffer[i];
      const r = px.r*br, g=px.g*br, b=px.b*br;
      this.leds[i].style.background = `rgb(${r},${g},${b})`;
    }
  }

  setBrightness(b) { this.brightness = Math.max(0,Math.min(255,b)); }
  getBrightness() { return this.brightness; }
  numPixels() { return this.num; }

  fill(color=0, first=0, count=0){
    if(count===0) count=this.num-first;
    for(let i=first;i<first+count;i++) this.setPixelColor(i,color);
  }

  clear(){ this.fill(0); }

  setPixelColor(i,r,g,b,w){
    if(typeof r==="number" && g===undefined){
      this.buffer[i] = this.unpackColor(r);
      return;
    }
    this.buffer[i] = { r:r||0,g:g||0,b:b||0,w:w||0 };
  }

  getPixelColor(i){
    const px=this.buffer[i];
    return (px.w<<24)|(px.r<<16)|(px.g<<8)|px.b;
  }

  Color(r,g,b,w=0){ return (w<<24)|(r<<16)|(g<<8)|b; }

  unpackColor(c){
    return { w:(c>>24)&255, r:(c>>16)&255, g:(c>>8)&255, b:c&255 };
  }

  ColorHSV(h,s=255,v=255){
    h=h%65536;
    let region=Math.floor(h/10923), f=(h%10923)/10923;
    let p=v*(1-s/255), q=v*(1-f*s/255), t=v*(1-(1-f)*s/255);
    let r,g,b;
    switch(region){
      case 0: r=v; g=t; b=p; break;
      case 1: r=q; g=v; b=p; break;
      case 2: r=p; g=v; b=t; break;
      case 3: r=p; g=q; b=v; break;
      case 4: r=t; g=p; b=v; break;
      default: r=v; g=p; b=q;
    }
    return this.Color(r,g,b);
  }

  gamma8(x){ return gammaTable[x]; }
  gamma32(c){
    const px=this.unpackColor(c);
    return this.Color(this.gamma8(px.r), this.gamma8(px.g), this.gamma8(px.b), this.gamma8(px.w));
  }

  Wheel(pos){
    pos=255-pos;
    if(pos<85) return this.Color(255-pos*3,0,pos*3);
    if(pos<170){ pos-=85; return this.Color(0,pos*3,255-pos*3); }
    pos-=170; return this.Color(pos*3,255-pos*3,0);
  }
}

// ================= HELPERS =================
function newStrip(numPixels, pin, type="GRB"){
  const strip = new WebNeoPixel(numPixels,pin,type);
  allStrips.push(strip);
  strip.attachToDOM(`Pin ${pin}`);
  return strip;
}

function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

// ================= ARDUINO PREPROCESSOR =================
function preprocessArduinoCode(code){
  // Remove all #include / #define / #pragma lines
  code = code.replace(/^\s*#.*$/gm,"");

  // Replace NEO_* constants
  code = code.replace(/\bNEO_GRB\b/g, `"GRB"`);
  code = code.replace(/\bNEO_RGB\b/g, `"RGB"`);
  code = code.replace(/\bNEO_RGBW\b/g, `"RGBW"`);
  code = code.replace(/\bNEO_BRG\b/g, `"BRG"`);
  code = code.replace(/\bNEO_GBR\b/g, `"GBR"`);
  code = code.replace(/\bNEO_BGR\b/g, `"BGR"`);

  // Convert constructors
  code = code.replace(/Adafruit_NeoPixel\s+(\w+)\s*=\s*Adafruit_NeoPixel\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*([^)]+)\);/g,
    `let $1 = newStrip($2,$3,$4);`);
  code = code.replace(/Adafruit_NeoPixel\s+(\w+)\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*([^)]+)\);/g,
    `let $1 = newStrip($2,$3,$4);`);

  // Convert delay() → await delay()
  code = code.replace(/\bdelay\s*\(/g,"await delay(");

  // Convert void setup()/loop()
  code = code.replace(/void\s+setup\s*\(\s*\)/,"async function setup()");
  code = code.replace(/void\s+loop\s*\(\s*\)/,"async function loop()");

  return code;
}

// ================= RUN BUTTON =================
runBtn.onclick = async () => {
  stripContainer.innerHTML = "";
  allStrips = [];

  let code = document.getElementById("codeInput").value;

  // Preprocess Arduino syntax
  code = preprocessArduinoCode(code);

  // Execute in sandbox with newStrip and delay available
  const sandbox = new Function(
    "newStrip","delay",
    `"use strict";
     ${code}
     if(typeof setup==='function') await setup();
     if(typeof loop==='function') while(true) await loop();
    `
  );

  sandbox(newStrip, delay);
};
