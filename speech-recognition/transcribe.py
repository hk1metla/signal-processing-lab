import os
import numpy as np
import soundfile as sf
from deepspeech import Model
from jiwer import wer
from scipy.signal import butter, lfilter

# === Update these paths based on your folder structure ===
AUDIO_FOLDER = 'audio_files'
MY_RECORDINGS_FOLDER = 'my_recordings'
RESULTS_FOLDER = 'results'
TRANSCRIPTION_FILE = 'transcriptions.txt'

MODELS = {
    'EN': {
        'model': 'models/English/deepspeech-0.9.3-models.pbmm',
        'scorer': 'models/English/deepspeech-0.9.3-models.scorer'
    },
    'IT': {
        'model': 'models/Italian/output_graph_it.pbmm',
        'scorer': 'models/Italian/kenlm_it.scorer'
    },
    'ES': {
        'model': 'models/Spanish/output_graph_es.pbmm',
        'scorer': 'models/Spanish/kenlm_es.scorer'
    }
}

# === Noise Filter Function ===
def low_pass_filter(signal, cutoff=4000, fs=16000, order=5):
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='low', analog=False)
    filtered = lfilter(b, a, signal)
    return filtered

# === Load ground truth transcriptions ===
def load_transcriptions(filepath):
    transcriptions = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            filename, text = line.strip().split('\t', 1)
            transcriptions[filename] = text.lower()
    return transcriptions

# === Transcription Function with optional Noise Filtering ===
def transcribe(audio_path, model_path, scorer_path, apply_filter=True):
    model = Model(model_path)
    model.enableExternalScorer(scorer_path)

    audio, sr = sf.read(audio_path)
    if sr != 16000:
        raise ValueError(f"Audio {audio_path} must be 16kHz")

    if audio.ndim > 1:
        audio = audio[:, 0]

    if apply_filter:
        audio = low_pass_filter(audio, cutoff=4000, fs=sr)

    audio = (audio * 32767).astype(np.int16)
    return model.stt(audio)

# === Process files with and without filter ===
def process_file(filename, file_path, lang, transcriptions, results_file):
    for apply_filter in [True, False]:
        filter_label = "Filtered" if apply_filter else "Unfiltered"

        prediction = transcribe(file_path, MODELS[lang]['model'], MODELS[lang]['scorer'], apply_filter).lower()
        ground_truth = transcriptions.get(filename, '').lower()
        error = wer(ground_truth, prediction) * 100 if ground_truth else 'N/A'

        print(f"[{filter_label}] File: {filename}")
        print(f"Transcript: {prediction}")
        print(f"WER: {error}\n")

        results_file.write(f"{filename}\t{filter_label}\t{ground_truth}\t{prediction}\t{error}\n")

# === Main function ===
def main():
    os.makedirs(RESULTS_FOLDER, exist_ok=True)
    transcriptions = load_transcriptions(TRANSCRIPTION_FILE)

    results_path = os.path.join(RESULTS_FOLDER, 'enhanced_results.txt')
    with open(results_path, 'w', encoding='utf-8') as results_file:
        results_file.write("Filename\tCondition\tGround Truth\tPrediction\tWER\n")

        for lang_folder in ['EN', 'IT', 'ES']:
            full_lang_path = os.path.join(AUDIO_FOLDER, lang_folder)
            print(f"\n=== Processing {lang_folder} audio files ===\n")

            for filename in os.listdir(full_lang_path):
                if not filename.endswith('.wav'):
                    continue

                file_path = os.path.join(full_lang_path, filename)

                # Detect language from filename
                if filename.endswith('_it.wav'):
                    lang = 'IT'
                elif filename.endswith('_es.wav'):
                    lang = 'ES'
                else:
                    lang = 'EN'

                process_file(filename, file_path, lang, transcriptions, results_file)

    # === Process My Recordings ===
    print(f"\n=== Processing your own recordings ===\n")

    for filename in os.listdir(MY_RECORDINGS_FOLDER):
        if not filename.endswith('.wav'):
            continue

        file_path = os.path.join(MY_RECORDINGS_FOLDER, filename)

        # Auto language detection for recordings
        if filename.endswith('_it.wav'):
            lang = 'IT'
        elif filename.endswith('_es.wav'):
            lang = 'ES'
        else:
            lang = 'EN'

        # Reopen results file in append mode
        with open(results_path, 'a', encoding='utf-8') as results_file:
            process_file(filename, file_path, lang, transcriptions, results_file)
    print(f"\nAll enhanced results saved to {results_path}")

if __name__ == "__main__":
    main()
