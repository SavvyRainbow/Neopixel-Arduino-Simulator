const stripContainer = document.getElementById("stripContainer");
const runBtn = document.getElementById("runBtn");

let allStrips = [];

class WebNeoPixel {
  constructor(numPixels, pin, type="GRB") {
    this.num = numPixels;
    this.pin = pin;
    this.type = type;
    this.brightness = 255;
    this.buffer = Array(numPixels).fill().map(() => ({r:0,g:0,b:0,w:0}));
    this.leds = [];
  }

  attachToDOM(labelText="") {
    const row = document.createElement("div");
    row.classList.add("stripRow");
    const label = document.createElement("div");
    label.classList.add("stripLabel");
    label.textContent = labelText;
    row.appendChild(label);

    for (let i=0;i<this.num;i++) {
      const led=document.createElement("div");
      led.classList.add("led");
      row.appendChild(led);
      this.leds.push(led);
    }

    stripContainer.appendChild(row);
  }

  begin(){}
  show(){
    const br=this.brightness/255;
    for(let i=0;i<this.num;i++){
      const px=this.buffer[i];
      this.leds[i].style.background=`rgb(${px.r*br},${px.g*br},${px.b*br})`;
    }
  }

  setBrightness(b){this.brightness=Math.max(0,Math.min(255,b));}
  fill(c,first=0,count=0){
    if(count===0) count=this.num-first;
    for(let i=first;i<first+count;i++) this.setPixelColor(i,c);
  }
  clear(){this.fill(0);}
  setPixelColor(i,r,g,b,w=0){
    if(g===undefined){ this.buffer[i]=this.unpackColor(r); return; }
    this.buffer[i]={r:r||0,g:g||0,b:b||0,w:w||0};
  }
  Color(r,g,b,w=0){return (w<<24)|(r<<16)|(g<<8)|b;}
  unpackColor(c){return{w:c>>24&255,r:c>>16&255,g:c>>8&255,b:c&255};}
}

class WebButton {
  constructor(label){
    this.callback=null;
    this.elem=document.createElement("button");
    this.elem.textContent=label;
    this.elem.classList.add("simButton");
    this.elem.onclick=()=>{ if(this.callback) this.callback(); };
    stripContainer.appendChild(this.elem);
  }
  onClick(cb){this.callback=cb;}
}

function newStrip(n,pin,type="GRB"){
  const s=new WebNeoPixel(n,pin,type);
  allStrips.push(s);
  s.attachToDOM(`Pin ${pin}`);
  return s;
}
function delay(ms){return new Promise(r=>setTimeout(r,ms));}

function preprocessArduinoCode(code){
  code=code.replace(/^\s*#.*$/gm,"");
  code=code.replace(/\bNEO_([A-Z]+)\b/g,(m,t)=>`"${t}"`);

  // NeoPixel constructor forms
  code=code.replace(
    /Adafruit_NeoPixel\s+(\w+)\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*"([A-Z]+)"\s*\)\s*;/gi,
    `let $1 = newStrip($2,$3,"$4");`
  );

  code=code.replace(
    /Adafruit_NeoPixel\s+(\w+)\s*=\s*Adafruit_NeoPixel\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*"([A-Z]+)"\s*\)\s*;/gi,
    `let $1 = newStrip($2,$3,"$4");`
  );

  // Buttons
  code=code.replace(
    /Button\s+(\w+)\s*=\s*new\s+Button\s*\("([^"]+)"\)\s*;/g,
    `let $1 = new WebButton("$2");`
  );

  // delay()
  code=code.replace(/\bdelay\s*\(/g,"await delay(");

  // Convert setup/loop to variables, NOT functions
  code=code.replace(/void\s+setup\s*\(\s*\)/,"setup = async ");
  code=code.replace(/void\s+loop\s*\(\s*\)/,"loop = async ");

  return code;
}

runBtn.onclick = async () => {
  stripContainer.innerHTML="";
  allStrips = [];

  let code=document.getElementById("codeInput").value;
  code=preprocessArduinoCode(code);

  try {
    // ✅ Wrap EVERYTHING inside one async function
    const wrapped = `
      let setup = async ()=>{};
      let loop = async ()=>{};

      ${code}

      await setup();
      while(true) await loop();
    `;

    await (async()=>{ eval(wrapped); })();

  } catch(err){
    console.error("Simulation error:",err);
  }
};
