// ----------------------------------------------------
// Global inputs and outputs
// -----------------------------------------------------

let imgElement = document.getElementById('imageSrc');
let inputElement = document.getElementById('fileInput');

let canvasWidth = document.getElementById("canvasWidth");
let canvasHeight = document.getElementById("canvasHeight");
let quantity = document.getElementById("quantity");
let randomRotation = document.getElementById("randomRotation");
let rotationMin = document.getElementById("rotationMin");
let rotationMax = document.getElementById("rotationMax");
let scaleMin = document.getElementById("scaleMin");
let scaleMax = document.getElementById("scaleMax");
let minX = document.getElementById("minX");
let maxX = document.getElementById("maxX");
let minY = document.getElementById("minY");
let maxY = document.getElementById("maxY");

// Position Distribution Charactersitics
let minDistX = document.getElementById("minDistX");
let maxDistX = document.getElementById("maxDistX");
let meanX = document.getElementById("meanX");
let standardDeviationX = document.getElementById("standardDeviationX");
let skewX = document.getElementById("skewX");

let minDistY = document.getElementById("minDistY");
let maxDistY = document.getElementById("maxDistY");
let meanY = document.getElementById("meanY");
let standardDeviationY = document.getElementById("standardDeviationY");
let skewY = document.getElementById("skewY");

let canvas;
let ctx;
let M;
// ----------------------------------------------------
// Event Listeners
// -----------------------------------------------------

window.onload = function() {
  canvas = document.getElementById("canvasOutput");
  ctx = canvas.getContext("2d");
}

inputElement.addEventListener('change', (e) => {
  imgElement.src = URL.createObjectURL(e.target.files[0]);
}, false);

document.getElementById("generateButton").onclick = function() {
  // Set canvas to white and clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = canvasWidth.value;
  canvas.height = canvasHeight.value;

  // Read input mask image
  let imageMask = cv.imread("imageSrc");

  // Get output image canvas pixel data for OpenCV
  let outputImage = cv.imread('canvasOutput');

  let _minDistX = parseFloat(minDistX.value);
  let _maxDistX = parseFloat(maxDistX.value);
  let _meanX = parseFloat(meanX.value);
  let _standardDeviationX = parseFloat(standardDeviationX.value);
  let _skewX = parseFloat(skewX.value);
  let _minDistY = parseFloat(minDistY.value);
  let _maxDistY = parseFloat(maxDistY.value);
  let _meanY = parseFloat(meanY.value);
  let _standardDeviationY = parseFloat(standardDeviationY.value);
  let _skewY = parseFloat(skewY.value);

  // Loop over the number of imageMasks to place on output image
  for (let i = 0; i < quantity.value; i++) {
    // Apply random transformations according to inputs
    let processedImageMask = imageMask.clone();
    
    // Rotation
    RotateBound(processedImageMask, GetRandomInt(rotationMin.value, rotationMax.value));

    // Scale
    let scale = GetRandomFloat(scaleMin.value, scaleMax.value);
    cv.resize(
      processedImageMask, processedImageMask, 
      new cv.Size(Math.round(scale * processedImageMask.cols), Math.round(scale * processedImageMask.rows)), 
      0, 0, cv.INTER_AREA);

    // Position
    let x = randn_bm(
      _minDistX, _maxDistX, 
      _meanX, _standardDeviationX, _skewX
    ) * canvas.width;
    let y = randn_bm(
      _minDistY, _maxDistY, 
      _meanY, _standardDeviationY, _skewY
    ) * canvas.height;
    
    // Place the processedImageMask
    PlaceImageAt(
      outputImage, 
      processedImageMask, 
      x - processedImageMask.cols / 2, 
      y - processedImageMask.rows / 2);
    
    processedImageMask.delete();
  }

  // 
  cv.imshow('canvasOutput', outputImage);

  // OpenCV cleanup
  outputImage.delete();
  imageMask.delete();
}

// ----------------------------------------------------
// These are core functions of app
// -----------------------------------------------------

// Insert imageMask into outputImage at location (x, y)
// (0, 0) = top left
function PlaceImageAt(outputImage, imageMask, x, y) {
  for (let i = 0, w = imageMask.rows; i < w; i++) {
    for (let j = 0, h = imageMask.cols; j < h; j++) {
      if (
        x + j < outputImage.cols && 
        y + i < outputImage.rows &&
        x + j >= 0 && y + i >= 0 &&
        outputImage.ucharPtr(i + y, j + x)[3] !== 255
      ) {
        outputImage.ucharPtr(i + y, j + x)[0] = imageMask.ucharPtr(i, j)[0];
        outputImage.ucharPtr(i + y, j + x)[1] = imageMask.ucharPtr(i, j)[1];
        outputImage.ucharPtr(i + y, j + x)[2] = imageMask.ucharPtr(i, j)[2];
        outputImage.ucharPtr(i + y, j + x)[3] = Clamp(outputImage.ucharPtr(i + y, j + x)[3] + imageMask.ucharPtr(i, j)[3], 0, 255);
      }
    }
  }
}

function RotateBound(image, angle) {

  let cos = Math.abs(Math.cos(angle));
  let sin = Math.abs(Math.sin(angle));
  
  let w = image.cols;
  let h = image.rows;

  let nW = Math.ceil((h * sin) + (w * cos));
  let nH = Math.ceil((h * cos) + (w * sin));

  let mW = Math.max(w, nW);
  let mH = Math.max(w, nH);

  let dsize = new cv.Size(mW, mH);
  let center = new cv.Point(mW / 2, mH / 2);

  let M = cv.matFromArray(2, 3, cv.CV_64FC1, [1, 0, Math.ceil((mW - w) / 2), 0, 1, Math.ceil((mH - h)/2)]);
  cv.warpAffine(image, image, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

  M = cv.getRotationMatrix2D(center, angle, 1);
  cv.warpAffine(image, image, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
function GetRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

function GetRandomFloat(min, max) {
  return Math.random() * (max - min) + parseFloat(min);
}

// https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve
function randn_bm(min, max, mean, stdev, skew) {
  let u = 0, v = 0;
  while(u === 0) u = Math.random() //Converting [0,1) to (0,1)
  while(v === 0) v = Math.random()
  let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v )
  
  num = num * stdev + mean // Translate to 0 -> 1
  if (num > 1 || num < 0) 
  num = randn_bm(min, max, mean, stdev, skew) // resample between 0 and 1 if out of range
  
  else{
    num = Math.pow(num, skew) // Skew
    num *= max - min // Stretch to fill range
    num += min // offset to min
  }
  return num
}

function Clamp(num, min, max) {
  return num <= min 
    ? min 
    : num >= max 
      ? max 
      : num
}