import { editor } from "./index.html"; // get CodeMirror editor

let allStrips = [];

function newStrip(name, numLEDs, parent=document.getElementById("stripContainer")) {
    const strip = { name, numLEDs, leds: [] };

    const row = document.createElement("div");
    row.className = "stripRow";

    const label = document.createElement("div");
    label.className = "stripLabel";
    label.textContent = name;
    row.appendChild(label);

    for (let i=0;i<numLEDs;i++){
        const led = document.createElement("div");
        led.className = "led";
        row.appendChild(led);
        strip.leds.push(led);
    }

    parent.appendChild(row);
    allStrips.push(strip);

    strip.clear = () => strip.leds.forEach(l=>l.style.backgroundColor = "#111");
    strip.show = () => {};
    strip.setPixelColor = (i,color) => {
        if(i>=0 && i<strip.numLEDs) strip.leds[i].style.backgroundColor = color;
    };
    strip.fill = (color) => strip.leds.forEach(l=>l.style.backgroundColor=color);
    strip.numPixels = () => strip.numLEDs;
    strip.Color = (r,g,b) => `rgb(${r},${g},${b})`;
    strip.Wheel = (pos)=>{
        pos = 255-pos;
        if(pos<85) return `rgb(${255-pos*3},0,${pos*3})`;
        if(pos<170){pos-=85; return `rgb(0,${pos*3},${255-pos*3})`;}
        pos-=170; return `rgb(${pos*3},${255-pos*3},0)`;
    };
    return strip;
}

function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

function preprocessArduinoCode(code){
    return code.replace(/\bint\b/g,"let");
}

document.getElementById("runBtn").onclick = async ()=>{
    const container = document.getElementById("stripContainer");
    container.innerHTML="";
    allStrips=[];

    let code = editor.state.doc.toString();
    code = preprocessArduinoCode(code);

    try{
        const userFunc = new Function("newStrip","delay",
            `"use strict";
             return (async ()=>{
                 ${code}
                 if(typeof setup==="function") await setup();
                 if(typeof loop==="function") while(true) await loop();
             })();`
        );
        await userFunc(newStrip, delay);
    }catch(err){
        console.error("Simulation error:",err);
    }
};
