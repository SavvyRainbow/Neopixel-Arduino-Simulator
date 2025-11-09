const stripContainer = document.getElementById("stripContainer");
const runBtn = document.getElementById("runBtn");

let allStrips = [];

// Gamma table (optional)
const gammaTable = new Array(256).fill(0).map((_, i) =>
  Math.floor(Math.pow(i / 255, 2.6) * 255 + 0.5)
);

// NeoPixel simulation
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
      this.leds[i].style.background = `rgb(${px.r*br},${px.g*br},${px.b*br})`;
    }
  }

  setBrightness(b){ this.brightness = Math.max(0,Math.min(255,b)); }
  numPixels(){ return this.num; }

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

  Wheel(pos){
    pos=255-pos;
    if(pos<85) return this.Color(255-pos*3,0,pos*3);
    if(pos<170){ pos-=85; return this.Color(0,pos*3,255-pos*3); }
    pos-=170; return this.Color(pos*3,255-pos*3,0);
  }
}

// Button simulation
class WebButton {
  constructor(label){
    this.label = label;
    this.callback = null;

    this.elem = document.createElement("button");
    this.elem.textContent = label;
    this.elem.style.margin = "5px";
    this.elem.style.padding = "5px 15px";
    this.elem.style.border = "2px solid #0f0";
    this.elem.style.borderRadius = "5px";
    this.elem.style.background = "transparent";
    this.elem.style.color = "#fff";
    this.elem.style.cursor = "pointer";

    this.elem.addEventListener("click", () => {
      if(typeof this.callback === "function") this.callback();
    });

    stripContainer.appendChild(this.elem);
  }

  onClick(cb){
    this.callback = cb;
  }
}

// Create a new NeoPixel strip
function newStrip(numPixels, pin, type="GRB"){
  const strip = new WebNeoPixel(numPixels,pin,type);
  allStrips.push(strip);
  strip.attachToDOM(`Pin ${pin}`);
  return strip;
}

function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

// Preprocess Arduino-style code with top-level declarations
function preprocessArduinoCode(code){
  code = code.replace(/^\s*#.*$/gm,""); // remove #include

  // Collect NeoPixel declarations
  const pixelMatches = [...code.matchAll(/Adafruit_NeoPixel\s+(\w+)\s*=\s*Adafruit_NeoPixel\s*\([^)]+\);/g)];
  let topDeclarations = "";
  for(const m of pixelMatches){
    topDeclarations += m[0].replace(/Adafruit_NeoPixel\s+(\w+)\s*=\s*Adafruit_NeoPixel/, "let $1 = newStrip") + "\n";
  }
  code = code.replace(/Adafruit_NeoPixel\s+(\w+)\s*=\s*Adafruit_NeoPixel\s*\([^)]+\);/g, "");

  // Collect Button declarations
  const buttonMatches = [...code.matchAll(/Button\s+(\w+)\s*=\s*new\s+Button\s*\([^)]+\);/g)];
  for(const m of buttonMatches){
    topDeclarations += m[0].replace(/Button\s+(\w+)\s*=\s*new\s+Button/, "let $1 = new WebButton") + "\n";
  }
  code = code.replace(/Button\s+(\w+)\s*=\s*new\s+Button\s*\([^)]+\);/g, "");

  code = topDeclarations + code;

  // NeoPixel constants
  code = code.replace(/\bNEO_GRB\b/g, `"GRB"`);
  code = code.replace(/\bNEO_RGB\b/g, `"RGB"`);
  code = code.replace(/\bNEO_RGBW\b/g, `"RGBW"`);
  code = code.replace(/\bNEO_BRG\b/g, `"BRG"`);
  code = code.replace(/\bNEO_GBR\b/g, `"GBR"`);
  code = code.replace(/\bNEO_BGR\b/g, `"BGR"`);

  // Loop variables
  code = code.replace(/\b(for\s*\(\s*)(int|long|byte|char)(?=\s*\w)/g, "$1let");
  code = code.replace(/\b(int|long|byte|char)\b/g, "let ");

  // delay -> await delay
  code = code.replace(/\bdelay\s*\(/g,"await delay(");

  // setup/loop
  code = code.replace(/void\s+setup\s*\(\s*\)/,"async function setup()");
  code = code.replace(/void\s+loop\s*\(\s*\)/,"async function loop()");

  return code;
}

// Run button handler
runBtn.onclick = async () => {
  stripContainer.innerHTML = "";
  allStrips = [];

  let code = document.getElementById("codeInput").value;
  code = preprocessArduinoCode(code);

  try {
    // Extract top-level declarations (NeoPixel + Buttons)
    const declRegex = /(let\s+\w+\s*=\s*(newStrip|new WebButton)\([^\)]*\);)/g;
    let topDeclarations = "";
    let restOfCode = code.replace(declRegex, (match) => {
      topDeclarations += match + "\n";
      return "";
    });

    // Step 1: Evaluate declarations first
    eval(topDeclarations);

    // Step 2: Evaluate the rest of the code (functions)
    await (async function(newStrip, delay, WebButton){
      eval(restOfCode);
      if(typeof setup === "function") await setup();
      if(typeof loop === "function") while(true) await loop();
    })(newStrip, delay, WebButton);

  } catch(err) {
    console.error("Simulation error:", err);
  }
};
