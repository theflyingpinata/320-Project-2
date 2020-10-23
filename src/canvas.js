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

const KICK_FREQUENCY_START = 1;
const KICK_FREQUENCY_END = 6;
const KICK_BOUNCE_THRESHOLD = 220;
const AUDIODATA_MAX_VOLUME = 256;

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

function draw(params = {}, waveformHeight) {
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
            let radiusDifference;

            // Calcualte average kick volume
            for (let i = KICK_FREQUENCY_START; i < KICK_FREQUENCY_END; i++) {
                kickAvgVolume += audioData[i];
            }

            kickAvgVolume = kickAvgVolume / (KICK_FREQUENCY_END - KICK_FREQUENCY_START);
            //console.log(kickAvgVolume);

            // If the average kick volume is above a certain dB threshold, 
            // calcualte newRadius
            // NOTE: for WebAudio API, max dB for a given frequency data point is 256
            if (kickAvgVolume > KICK_BOUNCE_THRESHOLD) {
                newRadius = radius + (radius - (radius * (kickAvgVolume / AUDIODATA_MAX_VOLUME)));
                //isBouncing = true;  // set isBoucing to true for lerpPercent values
            }
            else {
                // if no kick is detected, set newRadius to radius
                newRadius = radius;
            }

            radiusDifference = newRadius - radius;

            if (radiusDifference != 0)
                bounceLerpPercent = radiusDifference / radius;

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

    if (params.showWaveform) {
        ctx.save();

        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.beginPath();

        let sliceWidth = canvasWidth / bufferLength;
        let x = 0;
        let sliceData;
        let sliceImage;

        for (let i = 0; i < bufferLength; i++) {

            let v = audioData[i] / bufferLength;
            let y = v * (waveformHeight / 2) / 2;

            if (i === 0) {
                ctx.moveTo(x, (waveformHeight / 2) - y);
            } else {
                ctx.lineTo(x, (waveformHeight / 2) - y);
            }

            x += sliceWidth;
        }

        ctx.lineTo(canvasWidth, (waveformHeight / 2));
        ctx.stroke();

        ctx.restore();

        x = 0;
    }



    // 5 - draw circles
    if (params.showCircles) {
        let maxRadius = 100;//canvasHeight / 4;
        ctx.save();
        ctx.globalAplha = 0.75;
        for (let i = 0; i < audioData.length; i += 4) {
            // red-ish circles
            let percent = audioData[i] / 255;
            let colorPercent = Math.abs(i / audioData.length + colorRotation);

            let circleRadius = percent * maxRadius;

            // 
            ctx.beginPath();
            //ctx.fillStyle = `hsl(${360 * colorPercent},75%,75%)`;
            ctx.fillStyle = utils.makeColor(246, 246, 246, .3);
            ctx.arc(canvasWidth / 2, canvasHeight / 2, circleRadius, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.closePath();


            // blue-ish circles, bigger, more transparent
            ctx.beginPath();
            ctx.fillStyle = utils.makeColor(246, 246, 246, .3);
            ctx.arc(canvasWidth / 2, canvasHeight / 2, circleRadius, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.closePath();


            // yellow-ush circles, smaller
            ctx.beginPath();
            ctx.fillStyle = utils.makeColor(246, 246, 246, .3);
            ctx.arc(canvasWidth / 2, canvasHeight / 2, circleRadius, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.closePath();

        }
        ctx.restore();
    }

    // show date
    if (params.showDate) {
        let spacing = 11;
        ctx.save();
        ctx.font = "22px 'Heebo', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `hsl(${360 * (colorRotation / 2)},75%,50%)`;
        ctx.fillText(utils.getDate(), canvasWidth / 2, (canvasHeight / 2) - spacing);
        ctx.fillText(utils.getTime(), canvasWidth / 2, (canvasHeight / 2) + spacing);
        // ctx.strokeStyle = "black";
        // ctx.lineWidth = 1.5;
        // ctx.strokeText(utils.getDate(), canvasWidth/2, canvasHeight/2);
        // ctx.strokeText(utils.getTime(), canvasWidth/2, canvasHeight/2 + 22);
        ctx.restore();
    }

    if (params.showPixels)
    {
        let sliceWidth = canvasWidth / bufferLength;
        let x = 0;
        let sliceData;
        let sliceImage;

        ctx.save();

        for (let i = 0; i < bufferLength; i++) {

            let v = audioData[i] / bufferLength;
            let y = v * (waveformHeight / 2) / 2;

            sliceImage = ctx.getImageData(x, (waveformHeight / 2) - y, sliceWidth, 10);
            sliceData = sliceImage.data;

            for (let i = 0; i < sliceData.length; i += 4) {
                    let red = sliceData[i], green = sliceData[i + 1], blue = sliceData[i + 2];
                    sliceData[i] = 255 - red;
                    sliceData[i + 1] = 255 - green;
                    sliceData[i + 2] = 255 - blue;
            }

            ctx.putImageData(sliceImage, x, (5 + (waveformHeight / 2) - y));

            x += sliceWidth;
        }

        ctx.restore();
    }

    if (params.showConfetti) {
        let avgSnareVolume = 0;
        const SNARE_FREQUENCY_START = 5;
        const SNARE_FREQUENCY_END = 15;

        const WIDTH_BOUNDS = 50;
        const HEIGHT_BOUNDS = 50;
        let randomX = utils.getRandom(WIDTH_BOUNDS, canvasWidth - WIDTH_BOUNDS);
        let randomY = utils.getRandom(HEIGHT_BOUNDS, canvasWidth - HEIGHT_BOUNDS);
        let canvasWidthFourth = canvasWidth / 4;

        for (let i = SNARE_FREQUENCY_START; i < SNARE_FREQUENCY_END; i++) {
            avgSnareVolume += audioData[i];
        }

        avgSnareVolume = avgSnareVolume / (SNARE_FREQUENCY_END - SNARE_FREQUENCY_START);

        //console.log(avgSnareVolume);
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
    //let length = imageData.length;


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

export { setupCanvas, draw };