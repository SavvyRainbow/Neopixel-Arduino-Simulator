const stripContainer = document.getElementById("stripContainer");
const runBtn = document.getElementById("runBtn");

let allStrips = [];

const gammaTable = new Array(256).fill(0).map((_, i) =>
  Math.floor(Math.pow(i / 255, 2.6) * 255 + 0.5)
);

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

  fill(color=0, first=0, count
