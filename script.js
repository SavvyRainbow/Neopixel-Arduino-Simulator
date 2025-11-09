const LED_COUNT = 30;
let leds = [];

const strip = document.getElementById("ledStrip");
const runBtn = document.getElementById("runBtn");

function setupStrip() {
  strip.innerHTML = "";
  leds = [];

  for (let i = 0; i < LED_COUNT; i++) {
    const led = document.createElement("div");
    led.classList.add("led");
    strip.appendChild(led);
    leds.push(led);
  }
}

function setPixelColor(i, r, g, b) {
  leds[i].style.background = `rgb(${r},${g},${b})`;
}

function show() { /* Nothing needed here */ }

// Fake delay using async
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runBtn.onclick = async () => {
  setupStrip();

  const code = document.getElementById("codeInput").value;

  // Build sandboxed environment
  const sandbox = new Function(
    "setPixelColor", "show", "delay",
    `"use strict"; return (async () => { ${code} })()`
  );

  sandbox(setPixelColor, show, delay);
};

setupStrip();
