# Signal Processing Lab

A collection of audio algorithms: **lossless Rice coding, FFT analysis, demodulation, LSB steganography, speech-recognition evaluation and browser audio effects**.

**Python · NumPy · SciPy · p5.js · digital signal processing**

## Project guide

| Project | Entry point | Status |
| --- | --- | --- |
| Lossless PCM codec | `rice_codec.py` | 20 round trips verified |
| Spectral analysis and demodulation | `notebooks/spectral-analysis.ipynb` | Source preserved; provide WAV inputs |
| Seeded LSB steganography | `notebooks/audio-steganography.ipynb` | Source preserved; provide signed PCM audio |
| Filtered/unfiltered ASR evaluation | `speech-recognition/transcribe.py` | Legacy prototype; model files required |
| Browser effects chain | `browser-audio/audio-effects/` | Local-media prototype |
| Audio visualisation / voice control | `browser-audio/audio-visualisation/` | Historical experimental source |

## Start with the verified codec

```bash
python -m pip install -r requirements.txt
python smoke_test.py
python rice_codec.py encode input.wav output.ex2
python rice_codec.py decode output.ex2 decoded.wav
```

Input must be signed **16-bit PCM WAV**. The implementation handles mono and interleaved stereo. Zigzag mapping turns signed samples into nonnegative integers; Rice coding writes a unary quotient and a k-bit remainder. A compact header retains sample rate, channel count, bit depth, parameter and frame count.

`smoke_test.py` verifies exact sample equality and sample rate after decoding for mono/stereo, random/extreme sample values and four explicit settings and automatic selection. Compression is data-dependent; Rice coding can expand noisy or high-amplitude input. The EX2 format is an experimental format, not a replacement for a hardened media decoder. Use trusted files.

## Compression on generated signals

Automatic mode chooses the shortest Rice bit count across all supported parameters. It also tries first differences within each channel. If differences win, version 2 records this in the header. A fixed `--k` writes the historical version 1 raw-sample format. The decoder reads both versions.

| One second at 16 kHz | Selected k | WAV bytes | EX2 bytes | EX2 / WAV |
| --- | ---: | ---: | ---: | ---: |
| Silence | 0 | 32044 | 2017 | 0.063 |
| 440 Hz sine | 12 | 32044 | 27547 | 0.860 |
| Seeded noise | 14 | 32044 | 32999 | 1.030 |

A ratio below 1 means a smaller file. The sine wave compresses, while nearly uniform noise expands slightly. Run `python compare_sizes.py` to regenerate these signals, file sizes and exact decode checks.

## Explore the notebooks

```bash
jupyter lab notebooks
```

The spectral notebook inspects FFT magnitudes and tries carrier frequencies for demodulation. Its spectral sum is a heuristic ranking, not calibrated physical energy or evidence of malicious content. The steganography notebook inserts message bits at seeded pseudo-random sample positions and recovers them with the same seed and known length. This is a signal-processing demonstration, not secure encryption or a robust covert channel. Use synthetic or personally owned input audio.

## Browser audio

```bash
python browser-audio/audio-effects/generate_fixture.py
python -m http.server 8000 --directory browser-audio
```

Open `http://localhost:8000/audio-effects/`. The generated chirp replaces the recovered commercial music sample; you can select your own audio through the interface. Start playback explicitly. Microphone capture requires your browser permission and should be tested locally.

The separate visualisation/voice-control source still expects sound files and a compatible speech-recognition library. See its local README. It is retained as an experimental implementation, not a completed authentication system.

## Speech recognition

The recovered script compares filtered/unfiltered audio and computes word error rate against a transcription file. It expects compatible DeepSpeech model/scorer files for EN, ES and IT, 16 kHz audio, and the directory layout documented in `speech-recognition/README.md`. Those weights, personal recordings and third-party audio are not published. Full ASR execution was not reproduced.


## Source and maintenance

Recovered implementations from Shahzaib Naeem’s project backups, maintained for public review. See [SOURCES.md](SOURCES.md) for origins, third-party components and preparation changes. Run records describe software checks, not independently validated research outcomes.
