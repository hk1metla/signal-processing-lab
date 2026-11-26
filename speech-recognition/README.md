# Filtered and Unfiltered Speech Recognition

Recovered DeepSpeech evaluation script. Supply `models/English/`, `models/Italian/` and `models/Spanish/` with the filenames in `MODELS`, plus `audio_files/EN`, `audio_files/IT`, `audio_files/ES`, `my_recordings/` and a tab-delimited `transcriptions.txt`. Run from this folder with a Python environment compatible with the selected DeepSpeech binaries. Dependencies: numpy, scipy, soundfile, jiwer and deepspeech. No model downloads occur automatically.

Input audio must be 16 kHz. The script applies an optional 4 kHz low-pass filter and compares WER. Model/scorer files, recordings and historical scores are not bundled. Only source syntax was checked in this release; full transcription was not reproduced.
