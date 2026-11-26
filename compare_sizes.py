"""Measure whole-file sizes on three reproducible one-second PCM signals."""
import tempfile
from pathlib import Path

import numpy as np
from scipy.io import wavfile

from rice_codec import encode_wav_to_ex2, decode_ex2_to_wav


def main():
    rate = 16000
    index = np.arange(rate)
    signals = {
        "Silence": np.zeros(rate, dtype=np.int16),
        "440 Hz sine": np.rint(24000 * np.sin(2 * np.pi * 440 * index / rate)).astype(np.int16),
        "Seeded noise": np.random.default_rng(42).integers(-32768, 32768, rate, dtype=np.int16),
    }
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        for name, samples in signals.items():
            source, encoded, decoded = [root / f for f in ("in.wav", "out.ex2", "decoded.wav")]
            wavfile.write(source, rate, samples)
            k = encode_wav_to_ex2(source, None, encoded)
            decode_ex2_to_wav(encoded, decoded)
            recovered_rate, recovered = wavfile.read(decoded)
            assert recovered_rate == rate and np.array_equal(recovered, samples)
            print(f"{name} | {k} | {source.stat().st_size} | {encoded.stat().st_size} | "
                  f"{encoded.stat().st_size/source.stat().st_size:.3f}")


if __name__ == "__main__":
    main()
