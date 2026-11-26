let soundFile;
let mic;
let currentSource; // To keep track of the active audio source (soundFile or mic)

let lowPassFilter;
let waveshaperDistortion;
let dynamicCompressor;
let reverbEffect;
let delayEffect;

let recorder;
let soundRecorder; // For recording output
let recording = false;

let fftIn; // FFT for original signal
let fftOut; // FFT for processed signal

let spectrumInCanvas;
let spectrumOutCanvas;
let spectrumInCtx;
let spectrumOutCtx;

let masterVolumeSlider;

function preload() {
  soundFile = loadSound('synthetic-chirp.wav');
}

function setup() {
  noCanvas();

  getHTMLElements();
  initializeAudioEffects();

  // ADD THESE TWO LINES FOR DIAGNOSIS
  console.log('p5.soundOut object:', p5.soundOut);
  console.log('waveshaperDistortion object:', waveshaperDistortion);

  currentSource = soundFile;
  currentSource.disconnect();
  currentSource.connect(lowPassFilter);

  fftIn = new p5.FFT();
  fftOut = new p5.FFT();
  fftIn.setInput(currentSource);
  fftOut.setInput(reverbEffect);

  soundRecorder = new p5.SoundRecorder();
  recorder = new p5.SoundFile();
  soundRecorder.setInput(reverbEffect);
}

function getHTMLElements() {
  // Playback Controls
  select('#playButton').mousePressed(playAudio);
  select('#pauseButton').mousePressed(pauseAudio);
  select('#stopButton').mousePressed(stopAudio);
  select('#skipToStartButton').mousePressed(skipToStart);
  select('#skipToEndButton').mousePressed(skipToEnd);
  select('#loopButton').mousePressed(toggleLoop);
  select('#recordButton').mousePressed(toggleRecord);

  // Audio Source Selection
  select('#fileSource').changed(selectAudioSource);
  select('#micSource').changed(selectAudioSource);
  select('#audioFileInput').changed(handleFileInput);

  // Filter Controls
  select('#cutoffFreq').changed(updateFilter);
  select('#resonance').changed(updateFilter);
  select('#filterDryWet').changed(updateFilter);
  select('#filterOutputLevel').changed(updateFilter);
  selectAll('input[name="filterType"]').forEach(radio => radio.changed(updateFilter));


  // Delay Controls
  select('#delayTime').changed(updateDelay);
  select('#delayFeedback').changed(updateDelay);
  select('#delayDryWet').changed(updateDelay);

  // Distortion Controls
  select('#distortionAmount').changed(updateDistortion);
  select('#oversample').changed(updateDistortion);
  select('#distortionDryWet').changed(updateDistortion);
  select('#distortionOutputLevel').changed(updateDistortion);

  // Compressor Controls
  select('#attack').changed(updateCompressor);
  select('#knee').changed(updateCompressor);
  select('#release').changed(updateCompressor);
  select('#ratio').changed(updateCompressor);
  select('#threshold').changed(updateCompressor);
  select('#compressorDryWet').changed(updateCompressor);
  select('#compressorOutputLevel').changed(updateCompressor);

  // Reverb Controls
  select('#reverbDuration').changed(updateReverb);
  select('#decayRate').changed(updateReverb);
  select('#reverseReverb').mousePressed(toggleReverbReverse);
  select('#reverbDryWet').changed(updateReverb);
  select('#reverbOutputLevel').changed(updateReverb);

  // Master Volume
  // masterVolumeSlider = select('#masterVolume');
  // masterVolumeSlider.changed(() => {
  //   p5.soundFile.setVolume(masterVolumeSlider.value());
  //   console.log("master volume", masterVolume);
  // });

  // Spectrum Canvases
  // .elt is important to get the raw HTML canvas element, not a p5.Element object
  spectrumInCanvas = select('#spectrumInCanvas').elt;
  spectrumOutCanvas = select('#spectrumOutCanvas').elt;
  spectrumInCtx = spectrumInCanvas.getContext('2d');
  spectrumOutCtx = spectrumOutCanvas.getContext('2d');
}

function initializeAudioEffects() {
  lowPassFilter = new p5.Filter('lowpass'); // Default to lowpass
  delayEffect = new p5.Delay(); // Initialize delay
  waveshaperDistortion = new p5.Distortion();
  dynamicCompressor = new p5.Compressor();
  reverbEffect = new p5.Reverb();

  // Connect the effects in a chain as per Figure 2, with Delay added before Compressor
  // SoundSource (soundFile/mic) -> Filter -> Delay -> Distortion -> Compressor -> Reverb -> Master Volume (p5.soundOut)

  // Initially, the currentSource (soundFile) is connected to lowPassFilter in setup()
  // Here, we define the chain *after* the filter.
  lowPassFilter.disconnect(); // Ensure filter isn't connected to default output
  lowPassFilter.connect(delayEffect); // Connect filter to delay

  delayEffect.disconnect(); // Ensure delay isn't connected to default output
  delayEffect.connect(waveshaperDistortion); // Connect delay to distortion

  waveshaperDistortion.disconnect(); // Ensure distortion isn't connected to default output
  waveshaperDistortion.connect(dynamicCompressor); // Connect distortion to compressor

  dynamicCompressor.disconnect(); // Ensure compressor isn't connected to default output
  dynamicCompressor.connect(reverbEffect); // Connect compressor to reverb

  reverbEffect.disconnect(); // Ensure reverb isn't connected to default output
  reverbEffect.connect(p5.soundOut); // Connect the last effect to the master output
}

function draw() {
  // This loop runs continuously to update the spectrum displays
  drawSpectrum(fftIn, spectrumInCtx, spectrumInCanvas);
  drawSpectrum(fftOut, spectrumOutCtx, spectrumOutCanvas);
}

function drawSpectrum(fftInstance, ctx, canvasElement) {
  let waveform = fftInstance.waveform(); // Get time-domain waveform data (values between -1 and 1)

  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height); // Clear previous drawing
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Subtle background
  ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#00e676'; // Neon green for the waveform
  ctx.fillStyle = 'rgba(0, 230, 118, 0.2)'; // Semi-transparent neon green fill

  ctx.beginPath();
  // Start drawing the waveform from the left edge of the canvas
  let x = 0;
  // Map the first sample of the waveform to the center of the canvas height
  let y = map(waveform[0], -1, 1, 0, canvasElement.height);
  ctx.moveTo(x, y);

  // Draw the waveform line
  for (let i = 0; i < waveform.length; i++) {
    x = map(i, 0, waveform.length, 0, canvasElement.width);
    y = map(waveform[i], -1, 1, 0, canvasElement.height); // Map -1 to 1 to full canvas height
    ctx.lineTo(x, y);
  }

  // To create a filled waveform, connect back to the bottom and then close the path
  ctx.lineTo(canvasElement.width, canvasElement.height); // Go to bottom right
  ctx.lineTo(0, canvasElement.height); // Go to bottom left
  ctx.closePath(); // Close the shape

  ctx.stroke(); // Draw the outline
  ctx.fill();   // Fill the shape
}


// Playback Functions
function playAudio() {
  if (currentSource === soundFile) {
    if (soundFile.isLoaded() && !soundFile.isPlaying()) {
      soundFile.play();
    }
  } else if (currentSource === mic) {
    // Mic is always "playing" when active, but ensure its gain is not zero
    if (!mic) { // If mic hasn't been initialized yet
      mic = new p5.AudioIn();
      mic.start();
      mic.disconnect(); // Disconnect to control routing
      mic.connect(lowPassFilter); // Connect directly to the filter
      fftIn.setInput(mic); // Update FFT input
    } else if (!mic.started) { // If mic was stopped
      mic.start();
    }
    // Ensure audio context is resumed for mic input (browser policy)
    getAudioContext().resume();
  }
}

function pauseAudio() {
  if (currentSource === soundFile && soundFile.isPlaying()) {
    soundFile.pause();
  }
}

function stopAudio() {
  if (currentSource === soundFile) {
    soundFile.stop();
  } else if (currentSource === mic) {
    // For mic, 'stop' means stopping the mic input
    if (mic && mic.started) {
      mic.stop();
    }
  }
}

function skipToStart() {
  if (currentSource === soundFile) {
    soundFile.jump(0);
  }
}

function skipToEnd() {
  if (currentSource === soundFile) {
    soundFile.jump(soundFile.duration() - 0.1); // Jump close to end
  }
}

function toggleLoop() {
  if (currentSource === soundFile) {
    soundFile.setLoop(!soundFile.isLooping());
    // Update button text to reflect loop state
    select('#loopButton').html(soundFile.isLooping() ? 'Looping (ON)' : 'Loop (OFF)');
  }
}

function toggleRecord() {
  if (!recording) {
    // Start recording
    // Check if audio context is running
    if (getAudioContext().state !== 'running') {
      getAudioContext().resume();
    }
    soundRecorder.record(recorder);
    select('#recordButton').html('Stop Recording');
    recording = true;
  } else {
    // Stop recording and save
    soundRecorder.stop();
    saveSound(recorder, 'processed_audio.wav'); // This triggers a browser download
    select('#recordButton').html('Record');
    recording = false;
  }
}

// Effect Update Functions (called when corresponding sliders/selects are changed)
function updateFilter() {
  // Get all filter type radio buttons using standard JavaScript
  const filterRadios = document.querySelectorAll('input[name="filterType"]');
  let type = 'lowpass'; // Default value, will be updated by checked radio

  // Loop through radios to find the checked one
  for (let i = 0; i < filterRadios.length; i++) {
    if (filterRadios[i].checked) { // Accessing the 'checked' PROPERTY
      type = filterRadios[i].value;
      break; // Found the checked one, exit loop
    }
  }

  lowPassFilter.setType(type);
  lowPassFilter.freq(select('#cutoffFreq').value());
  lowPassFilter.res(select('#resonance').value());
  lowPassFilter.drywet(select('#filterDryWet').value());
  lowPassFilter.amp(select('#filterOutputLevel').value());
}

function updateDelay() {
  delayEffect.delayTime(select('#delayTime').value());
  delayEffect.feedback(select('#delayFeedback').value());
  delayEffect.drywet(select('#delayDryWet').value());
}

function updateDistortion() {
  // CORRECTED: Ensure p5.Distortion.amount() is called on a valid object.
  // The error `waveshaperDistortion.amount is not a function` suggests 'waveshaperDistortion'
  // might not be properly initialized as a p5.Distortion object if the p5.sound library
  // itself isn't loaded/initialized correctly.
  // If the library is correctly loaded, this line should be fine for p5.js v1.2.0 and p5.sound v1.0.1.
  waveshaperDistortion.set(Number(select('#distortionAmount').value()))
  waveshaperDistortion.set(select('#oversample').value()); // This is also correct
  waveshaperDistortion.drywet(select('#distortionDryWet').value());
  waveshaperDistortion.amp(select('#distortionOutputLevel').value());
}

function updateCompressor() {
  dynamicCompressor.attack(select('#attack').value());
  dynamicCompressor.knee(select('#knee').value());
  dynamicCompressor.release(select('#release').value());
  dynamicCompressor.ratio(select('#ratio').value());
  dynamicCompressor.threshold(select('#threshold').value());
  dynamicCompressor.drywet(select('#compressorDryWet').value());
  dynamicCompressor.amp(select('#compressorOutputLevel').value());
}

function updateReverb() {
  // Reverb set() takes (duration, decayRate, reverse)
  let duration = select('#reverbDuration').value();
  let decayRate = select('#decayRate').value();
  // Keep reverse state as it was, or reset if desired. For now, assume toggleReverbReverse handles it.
  reverbEffect.set(duration, decayRate);
  reverbEffect.drywet(select('#reverbDryWet').value());
  reverbEffect.amp(select('#reverbOutputLevel').value());
}

function toggleReverbReverse() {
  let duration = select('#reverbDuration').value();
  let decayRate = select('#decayRate').value();
  // Toggle the reverse state. A more advanced implementation might read the current state.
  // For simplicity, this button just applies reverse. Subsequent calls would re-reverse.
  reverbEffect.set(duration, decayRate, true); // Set the third argument to true for reverse
}

// Audio Source Selection
function selectAudioSource() {
  // Disconnect the currently active source from the filter
  if (currentSource) {
    currentSource.disconnect();
  }

  // Get the raw HTML radio button elements using standard JavaScript
  const fileSourceRadio = document.getElementById('fileSource'); // CORRECTED LINE
  const micSourceRadio = document.getElementById('micSource'); // CORRECTED LINE

  if (fileSourceRadio.checked) { // Accessing the 'checked' PROPERTY of the raw DOM element
    // If mic was active, stop it
    if (mic && mic.started) {
      mic.stop();
    }
    currentSource = soundFile;
    // Reconnect new currentSource to filter
    soundFile.disconnect(); // Ensure it's not connected twice
    soundFile.connect(lowPassFilter);
    fftIn.setInput(soundFile); // Update FFT input to the sound file
  } else if (micSourceRadio.checked) { // Accessing the 'checked' PROPERTY of the raw DOM element
    // Request microphone access and resume audio context
    getAudioContext().resume();
    if (!mic) {
      mic = new p5.AudioIn();
      mic.start(); // Start mic input
    } else if (!mic.started) {
      mic.start();
    }
    currentSource = mic;
    // Reconnect new currentSource to filter
    mic.disconnect(); // Ensure it's not connected twice
    mic.connect(lowPassFilter);
    fftIn.setInput(mic); // Update FFT input to the microphone
  }
}

function handleFileInput(event) {
  const file = event.target.files[0]; // Get the first file from the input
  if (file) {
    // Stop any currently playing sound to prepare for the new one
    if (soundFile && soundFile.isPlaying()) {
      soundFile.stop();
    }
    // Disconnect the old sound file from the chain if it was connected
    if (soundFile) {
      soundFile.disconnect();
    }

    // Load the new sound file
    loadSound(file, (newSound) => {
      soundFile = newSound; // Assign the new sound to the global variable
      // Get the fileSourceRadio element again within this function's scope
      const fileSourceRadio = document.getElementById('fileSource'); // ADDED THIS LINE FOR SCOPE FIX

      // If file source is currently selected, connect the new sound file
      if (fileSourceRadio && fileSourceRadio.checked) { // Check if it exists and is checked
        currentSource = soundFile;
        soundFile.disconnect(); // Just in case, ensure clean connection
        soundFile.connect(lowPassFilter);
        fftIn.setInput(soundFile); // Update FFT input to the new sound file
      }
      // Optional: Automatically play the new sound file after loading
      // if (select('#fileSource').checked()) {
      //    soundFile.play();
      // }
    },
      (error) => { // Error callback for loadSound
        console.error("Error loading sound file:", error);
        alert("Could not load audio file. Please try another one.");
      });
  }
}
