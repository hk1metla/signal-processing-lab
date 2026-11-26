let captchaSound;
let scrambledSound;
let playCaptchaButton;
let submitCaptchaButton;
let captchaAnswerInput;
let captchaStatus;
let fftCaptcha;

let visualAudio;
let playVisualButton;
let visualSelector;
let canvas;
let meydaAnalyzer;
let features = {};
let shapeType = "circle";
let bgColor = "black";
let speechRec;

function preload() {
    captchaSound = loadSound('assets/sounds/your_captcha_word.wav');  // Replace with your captcha audio filename
    visualAudio = loadSound('assets/sounds/Ex2_sound1.wav');      // Default visualisation sound
}

function setup() {
    canvas = createCanvas(500, 300);
    canvas.parent(select('#visualisation-canvas'));
    background(bgColor);

    setupCaptchaSection();
    setupVisualisationSection();
    setupSpeechRecognition();
}

function draw() {
  background(bgColor);
  console.log("Shape Type:", shapeType);  // Confirm value every frame

  if (meydaAnalyzer && visualAudio.isPlaying()) {
    features = meydaAnalyzer.get();
  }

  let rms = features && features.rms ? features.rms : 0;
  let centroid = features && features.spectralCentroid ? features.spectralCentroid : 0;
  let flatness = features && features.spectralFlatness ? features.spectralFlatness : 0;

  let size = map(rms, 0, 0.3, 10, 200);
  let colorVal = map(centroid, 0, 8000, 0, 255);
  let rotation = map(flatness, 0, 1, 0, TWO_PI);

  translate(width / 2, height / 2);
  rotate(rotation);

  fill(colorVal, 100, 255 - colorVal, 150);
  stroke(255);
  strokeWeight(2);

  switch (shapeType) {
    case 'circle':
      ellipse(0, 0, size, size);
      break;
    case 'square':
      rectMode(CENTER);
      rect(0, 0, size, size);
      break;
    case 'triangle':
      triangle(-size / 2, size / 2, size / 2, size / 2, 0, -size / 2);
      break;
    case 'pentagon':
      beginShape();
      for (let i = 0; i < 5; i++) {
        let angle = TWO_PI * i / 5;
        vertex(cos(angle) * size / 2, sin(angle) * size / 2);
      }
      endShape(CLOSE);
      break;
  }
}



function draw() {
    if (meydaAnalyzer && visualAudio.isPlaying()) {
        features = meydaAnalyzer.get();
        drawVisualisation();
    }
}

//////////////////////////
// Audio CAPTCHA Section //
//////////////////////////

function setupCaptchaSection() {
    playCaptchaButton = select('#play-captcha');
    submitCaptchaButton = select('#submit-captcha');
    captchaAnswerInput = select('#captcha-answer');
    captchaStatus = select('#captcha-status');

    fftCaptcha = new p5.FFT();

    playCaptchaButton.mousePressed(playCaptcha);
    submitCaptchaButton.mousePressed(checkCaptcha);
}

function playCaptcha() {
    scrambledSound = captchaSound;

    let filter = new p5.BandPass();
    scrambledSound.disconnect();
    scrambledSound.connect(filter);
    filter.freq(1500);

    let reverb = new p5.Reverb();
    filter.disconnect();
    filter.connect(reverb);
    reverb.amp(0.6);

    scrambledSound.play();

    let visDiv = select('#captcha-visualisation');
    visDiv.html('');

    let c = createCanvas(400, 100);
    c.parent(visDiv);

    drawCaptchaVisual();
}

function drawCaptchaVisual() {
    noFill();
    stroke(255);

    function update() {
        background(50);
        let spectrum = fftCaptcha.analyze();
        beginShape();
        for (let i = 0; i < spectrum.length; i++) {
            let x = map(i, 0, spectrum.length, 0, width);
            let y = map(spectrum[i], 0, 255, height, 0);
            vertex(x, y);
        }
        endShape();

        if (scrambledSound.isPlaying()) {
            requestAnimationFrame(update);
        }
    }

    update();
}

function checkCaptcha() {
    let answer = captchaAnswerInput.value().toLowerCase();
    if (answer === 'hello') {  // Replace with actual correct answer
        captchaStatus.html('Correct!', 'color', 'green');
    } else {
        captchaStatus.html('Incorrect. Try again.', 'color', 'red');
    }
}

/////////////////////////////
// Audio Visualisation Part //
/////////////////////////////

function setupVisualisationSection() {
    visualSelector = select('#audio-selector');
    playVisualButton = select('#play-visualisation');

    playVisualButton.mousePressed(playVisualAudio);
}

function playVisualAudio() {
    if (visualAudio.isPlaying()) {
        visualAudio.stop();
    }

    let selectedFile = visualSelector.value();
    visualAudio = loadSound('assets/sounds/' + selectedFile, () => {
        visualAudio.play();
        setupMeyda();

        let visDiv = select('#visualisation-canvas');
        visDiv.html('');
        canvas = createCanvas(500, 300);
        canvas.parent(visDiv);
        background(bgColor);
    });
}

function setupMeyda() {
    if (meydaAnalyzer) meydaAnalyzer.stop();

    meydaAnalyzer = Meyda.createMeydaAnalyzer({
        audioContext: getAudioContext(),
        source: visualAudio,
        bufferSize: 512,
        featureExtractors: ['rms', 'spectralCentroid', 'spectralFlatness'],
        callback: () => { }
    });
    meydaAnalyzer.start();
}

function drawVisualisation() {
    if (!features) return;  // Prevent error if features are null

    background(bgColor);

    let rms = features.rms || 0;
    let centroid = features.spectralCentroid || 0;
    let flatness = features.spectralFlatness || 0;

    let size = map(rms, 0, 0.3, 10, 200);
    let colorVal = map(centroid, 0, 8000, 0, 255);
    let rotation = map(flatness, 0, 1, 0, TWO_PI);

    translate(width / 2, height / 2);
    rotate(rotation);

    fill(colorVal, 100, 255 - colorVal, 150);
    stroke(255);
    strokeWeight(2);

    switch (shapeType) {
        case 'circle':
            ellipse(0, 0, size, size);
            break;
        case 'square':
            rectMode(CENTER);
            rect(0, 0, size, size);
            break;
        case 'triangle':
            triangle(-size / 2, size / 2, size / 2, size / 2, 0, -size / 2);
            break;
        case 'pentagon':
            beginShape();
            for (let i = 0; i < 5; i++) {
                let angle = TWO_PI * i / 5;
                vertex(cos(angle) * size / 2, sin(angle) * size / 2);
            }
            endShape(CLOSE);
            break;
    }
}


//////////////////////////
// Voice Control Section //
//////////////////////////

function setupSpeechRecognition() {
    speechRec = new p5.SpeechRec('en-US', gotSpeech);
    speechRec.continuous = true;
    speechRec.interimResults = false;
    speechRec.start();
    console.log("Speech recognition started.");
}

function gotSpeech() {
    if (speechRec.resultValue) {
        console.log("Recognised:", speechRec.resultString);
        let said = speechRec.resultString.toLowerCase();

        if (['black', 'white', 'red', 'blue', 'green'].includes(said)) {
            document.body.style.backgroundColor = said;
            console.log("Background changed to:", said);
        }

        if (['square', 'triangle', 'circle', 'pentagon'].includes(said)) {
            shapeType = said;
            console.log("Background changed to:", said);
        }
    }
}
