/*
    The purpose of this file is to take in the analyser node and a <canvas> element: 
      - the module will create a drawing context that points at the <canvas> 
      - it will store the reference to the analyser node
      - in draw(), it will loop through the data in the analyser node
      - and then draw something representative on the canvas
      - maybe a better name for this file/module would be *visualizer.js* ?
*/

import * as utils from './utils.js';

let ctx, canvasWidth, canvasHeight, gradient, analyserNode, audioData;
let bufferLength;
let colorRotation = 0;
let bounceLerpPercent = 0;
let isBouncing = false;

const KICK_FREQUENCY_INDECIES = 5;

function setupCanvas(canvasElement, analyserNodeRef) {
    // create drawing context
    ctx = canvasElement.getContext("2d");
    canvasWidth = canvasElement.width;
    canvasHeight = canvasElement.height;
    // create a gradient that runs top to bottom
    gradient = utils.getLinearGradient(ctx, 0, 0, 0, canvasHeight, [{ percent: 0, color: "magenta" }, { percent: .25, color: "green" }, { percent: .5, color: "yellow" }, { percent: .75, color: "green" }, { percent: 1, color: "magenta" }]);
    // keep a reference to the analyser node
    analyserNode = analyserNodeRef;
    // this is the array where the analyser data will be stored
    analyserNode.fftSize = 256;
    bufferLength = analyserNode.frequencyBinCount;
    audioData = new Uint8Array(bufferLength);
}

function draw(params = {}) {
    // 1 - populate the audioData array with the frequency data from the analyserNode
    // notice these arrays are passed "by reference" 
    analyserNode.getByteFrequencyData(audioData);
    // OR
    //analyserNode.getByteTimeDomainData(audioData); // waveform data

    // 2 - draw background
    ctx.save();
    ctx.fillStyle = "black";
    ctx.globalAplha = .1;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();

    // 3 - draw gradient
    if (params.showGradient) {
        ctx.save();
        ctx.fillStyle = gradient;
        ctx.globalAplha = .3;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.restore();
    }

    // shows audio bars in a circle
    if (params.showBarCircle) {
        let numBars = audioData.length;
        let radius = 100;
        let barHeight = 75;
        let theta = Math.PI * 2 / numBars;
        let currentAngle = Math.PI + colorRotation;
        let barWidth = 2 * Math.PI * radius / numBars;

        // draw the bars
        ctx.save();
        //ctx.fillStyle = 'rgba(255,255,255,0.50)';
        ctx.strokeStyle = "white";//'rgba(0,0,0,0.50)';

        // Show the bounce effect on the visualizer when a kick happens
        if (params.showBounce) {
            let kickAvgVolume = 0;  // Average volume of the kick frequencies (100Hz - 1.3K Hz)
            let newRadius;  // New radius to lerp to when a kick happens

            // Calcualte average kick volume
            for (let i = 0; i < KICK_FREQUENCY_INDECIES; i++) {
                kickAvgVolume += audioData[i];
            }

            kickAvgVolume = kickAvgVolume / KICK_FREQUENCY_INDECIES;
            //console.log(kickAvgVolume);

            // If the average kick volume is above a certain dB threshold, 
            // calcualte newRadius
            // NOTE: for WebAudio API, max dB for a given frequency data point is 256
            if (kickAvgVolume > 230) {
                newRadius = radius + (radius - (radius * (kickAvgVolume / 256)));
                isBouncing = true;  // set isBoucing to true for lerpPercent values
            }
            else
            {
                // if no kick is detected, set newRadius to radius
                newRadius = radius;
            }

            // if the newRadius hasn't changed, we're no longer bouncing
            isBouncing = !(newRadius == radius);

            // if we are bouncing icnreanemt bounceLerpPercent for smooth bounce transition outwards
            if (isBouncing) {
                // Only increameent lerp if we are below the max lerp threshold (1)
                if (!(bounceLerpPercent >= 1)) {
                    bounceLerpPercent += .05;
                } else {
                    // If we are at the max lerp threshold, stop bouncing and lerp inwards
                    bounceLerpPercent = -.05;
                    isBouncing = false;
                }
            } else {
                // if we are not bouncing, lerp inwards
                if (bounceLerpPercent > 0) {
                    bounceLerpPercent -= .05;
                }
            }

            // lerp between radius and newRadius
            radius = utils.lerp(newRadius, radius, bounceLerpPercent);
        }

        for (let i = 0; i < numBars; i++) {
            let percent = audioData[i] / 256;
            //barHeight = barHeight * (percent * 1.20);
            ctx.save();
            let colorPercent = Math.abs(((currentAngle - Math.PI) / (Math.PI * 2)) + colorRotation);
            ctx.fillStyle = `hsl(${360 * colorPercent},90%,65%)`;
            ctx.translate(canvasWidth / 2, canvasHeight / 2);
            ctx.rotate(currentAngle);
            ctx.translate(0, radius);
            ctx.fillRect(0, 0, barWidth, barHeight * percent);
            //ctx.strokeRect(0, 0, barWidth, barHeight * percent);
            ctx.restore();
            currentAngle += theta;
        }
        ctx.restore();

    }

    // 4 - draw bars
    if (params.showBars) {
        let barSpacing = 4;
        let margin = 5;
        let screenWidthForBars = canvasWidth - (audioData.length * barSpacing) - margin * 2;
        let barWidth = screenWidthForBars / bufferLength;
        let barHeight = 200;
        let topSpacing = 100;

        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.50)';
        ctx.strokeStyle = 'rgba(0,0,0,0.50)';
        // loop through the data and draw!
        for (let i = 0; i < audioData.length; i++) {
            ctx.translate(0, 0);
            ctx.fillRect(margin + i * (barWidth + barSpacing), 256 - audioData[i], barWidth, barHeight);
            //ctx.strokeRect(margin + i * (barWidth + barSpacing), topSpacing + 256 - audioData[i], barWidth, barHeight);
        }
        ctx.restore();
    }

    // 5 - draw circles
    if (params.showCircles) {
        let maxRadius = 100;//canvasHeight / 4;
        ctx.save();
        ctx.globalAplha = 0.5;
        for (let i = 0; i < audioData.length; i += 4) {
            // red-ish circles
            let percent = audioData[i] / 255;
            let colorPercent = Math.abs(i / audioData.length + colorRotation);

            let circleRadius = percent * maxRadius;
            ctx.beginPath();
            //ctx.fillStyle = `hsl(${360 * colorPercent},75%,75%)`;
            ctx.fillStyle = utils.makeColor(246, 246, 246, .2);
            ctx.arc(canvasWidth / 2, canvasHeight / 2, circleRadius, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.closePath();

            // blue-ish circles, bigger, more transparent
            ctx.beginPath();
            ctx.fillStyle = utils.makeColor(246, 246, 246, .2);
            ctx.arc(canvasWidth / 2, canvasHeight / 2, circleRadius, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.closePath();

            // yellow-ush circles, smaller
            ctx.beginPath();
            ctx.fillStyle = utils.makeColor(10, 10, 10, .2);
            ctx.arc(canvasWidth / 2, canvasHeight / 2, circleRadius, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.closePath();

        }
        ctx.restore();
    }

    if (params.showDate) {
        let spacing = 11;
        ctx.save();
        ctx.font = "22px 'Heebo', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `hsl(${360 * (colorRotation / 2)},75%,75%)`;
        ctx.fillText(utils.getDate(), canvasWidth / 2, (canvasHeight / 2) - spacing);
        ctx.fillText(utils.getTime(), canvasWidth / 2, (canvasHeight / 2) + spacing);
        // ctx.strokeStyle = "black";
        // ctx.lineWidth = 1.5;
        // ctx.strokeText(utils.getDate(), canvasWidth/2, canvasHeight/2);
        // ctx.strokeText(utils.getTime(), canvasWidth/2, canvasHeight/2 + 22);
        ctx.restore();
    }

    if (params.showConfetti) {
        let kickAvgVolume = 0;

        ctx.save();

        for (let i = 0; i < 8; i++) {
            kickAvgVolume += audioData[i];
        }

        kickAvgVolume = kickAvgVolume / 8;

        //console.log("avg Kick volume = " + kickAvgVolume);

        if (kickAvgVolume > 230) {
            //drawConfetti();
        }

        ctx.restore();
    }

    // 6 - bitmap manipulation
    // TODO: right now. we are looping though every pixel of the canvas (320,000 of them!), 
    // regardless of whether or not we are applying a pixel effect
    // At some point, refactor this code so that we are looping though the image data only if
    // it is necessary

    // A) grab all of the pixels on the canvas and put them in the `data` array
    // `imageData.data` is a `Uint8ClampedArray()` typed array that has 1.28 million elements!
    // the variable `data` below is a reference to that array 
    let imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    let data = imageData.data;
    let length = data.length;
    let width = imageData.width; // not using here


    // Emboss effect
    if (params.showEmboss) {
        for (let i = 0; i < length; i++) {
            if (i % 4 == 3) continue; // skip alpha channel
            data[i] = 127 + 2 * data[i] - data[i + 4] - data[i + width * 4];
        }
    }
    // B) Iterate through each pixel, stepping 4 elements at a time (which is the RGBA for 1 pixel)
    for (let i = 0; i < length; i += 4) {
        // C) randomly change every 20th pixel to red
        // data[i] is the red channel
        // data[i+1] is the green channel
        // data[i+2] is the blue channel
        // data[i+3] is the alpha channel

        if (params.showNoise && Math.random() < .05) {
            data[i] = data[i + 1] = data[i + 2] = 0;// zero out the red and green and blue channels
            data[i] = 255;// make the red channel 100% red
            data[i + 1] = 255;
            data[i + 2] = 0;
        } // end if

        if (params.showInvert) {
            let red = data[i], green = data[i + 1], blue = data[i + 2];
            data[i] = 255 - red;
            data[i + 1] = 255 - green;
            data[i + 2] = 255 - blue;
        }
    } // end for

    // not we are stepping through *each* sub-pixel


    // D) copy image data back to canvas
    ctx.putImageData(imageData, 0, 0);

    colorRotation += .001;

}

let maxConfetti = 10;
let confettiSize = 10;

function drawConfetti() {
    for (let i = 0; i < maxConfetti; i++) {
        ctx.beginPath();
        //ctx.fillStyle = `hsl(${360 * colorPercent},75%,75%)`;
        ctx.fillStyle = utils.getRandomColor();
        ctx.arc(utils.getRandom(50, canvasWidth - 50),
            utils.getRandom(50, canvasHeight - 50),
            confettiSize,
            0,
            2 * Math.PI,
            false);
        ctx.fill();
        ctx.closePath();
    }
}

export { setupCanvas, draw };