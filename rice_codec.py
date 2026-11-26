import numpy as np
import struct
from pathlib import Path
from scipy.io import wavfile

class BitWriter:

    def __init__(self):
        self.buf = bytearray()
        self.cur = 0
        self.nbits = 0

    def write_bits(self, value, n):
        for i in range(n):
            bit = value >> n - 1 - i & 1
            self.cur = (self.cur << 1 | bit) & 255
            self.nbits += 1
            if self.nbits == 8:
                self.buf.append(self.cur)
                self.cur = 0
                self.nbits = 0

    def write_unary(self, q):
        while q >= 8:
            self.write_bits(255, 8)
            q -= 8
        if q > 0:
            self.write_bits((1 << q) - 1, q)
        self.write_bits(0, 1)

    def get_bytes(self):
        if self.nbits:
            self.buf.append(self.cur << 8 - self.nbits & 255)
        return bytes(self.buf)

class BitReader:

    def __init__(self, data: bytes):
        self.data = data
        self.i = 0
        self.cur = 0
        self.nbits = 0

    def _fill(self):
        if self.i < len(self.data):
            self.cur = self.data[self.i]
            self.i += 1
            self.nbits = 8
            return True
        return False

    def read_bit(self):
        if self.nbits == 0 and (not self._fill()):
            raise EOFError('Ran out of bits')
        bit = self.cur >> 7 & 1
        self.cur = self.cur << 1 & 255
        self.nbits -= 1
        return bit

    def read_bits(self, n):
        v = 0
        for _ in range(n):
            v = v << 1 | self.read_bit()
        return v

    def read_unary(self):
        q = 0
        while True:
            if self.read_bit() == 0:
                break
            q += 1
        return q

def zigzag_encode_int16(x: np.ndarray):
    x = x.astype(np.int32)
    return x << 1 ^ x >> 31

def zigzag_decode_int32(z: np.ndarray):
    return (z >> 1 ^ -(z & 1)).astype(np.int32)

def rice_encode(samples: np.ndarray, k: int) -> bytes:
    bw = BitWriter()
    mask = (1 << k) - 1
    for v in samples.astype(np.int64):
        q = int(v) >> k
        r = int(v) & mask
        bw.write_unary(q)
        if k > 0:
            bw.write_bits(r, k)
    return bw.get_bytes()

def rice_decode(count: int, k: int, br: BitReader) -> np.ndarray:
    out = np.empty(count, dtype=np.int32)
    for i in range(count):
        q = br.read_unary()
        r = br.read_bits(k) if k > 0 else 0
        out[i] = q << k | r
    return out

HDR_FMT = '<3sB I H H B I'

HDR_SIZE = struct.calcsize(HDR_FMT)

def rice_bits(values, k):
    return len(values) * (1 + k) + int((values >> k).sum(dtype=np.int64))


def choose_k(values):
    """Minimize the exact Rice bit count across parameters supported by EX2."""
    return min(range(17), key=lambda k: rice_bits(values, k))


def encode_wav_to_ex2(wav_path: str, k: int | None, out_path: str):
    sr, audio = wavfile.read(wav_path)
    if audio.dtype != np.int16:
        raise ValueError(f'Expected 16-bit PCM WAV, got {audio.dtype}. Convert to 16-bit PCM.')
    if audio.ndim == 1:
        ch, frames = (1, audio.shape[0])
        flat = audio
    else:
        ch, frames = (audio.shape[1], audio.shape[0])
        flat = audio.reshape(-1)
    z = zigzag_encode_int16(flat)
    version = 1
    if k is None:
        k = choose_k(z)
        # Subtract the previous sample in each channel, with signed 16-bit wrap.
        framed = flat.reshape(frames, ch)
        residuals = framed.copy()
        residuals[1:] = framed[1:] - framed[:-1]
        predicted = zigzag_encode_int16(residuals.ravel())
        predicted_k = choose_k(predicted)
        if rice_bits(predicted, predicted_k) < rice_bits(z, k):
            z, k, version = predicted, predicted_k, 2
    if not 0 <= k <= 16:
        raise ValueError("k must be between 0 and 16")
    payload = rice_encode(z, k)
    hdr = struct.pack(HDR_FMT, b'EX2', version, int(sr), int(ch), 16, int(k), int(frames))
    with open(out_path, 'wb') as f:
        f.write(hdr)
        f.write(payload)
    return k

def decode_ex2_to_wav(ex2_path: str, out_wav_path: str):
    data = Path(ex2_path).read_bytes()
    if len(data) < HDR_SIZE:
        raise ValueError('EX2 too small')
    magic, ver, sr, ch, bps, k, frames = struct.unpack(HDR_FMT, data[:HDR_SIZE])
    if magic != b'EX2' or ver not in (1, 2):
        raise ValueError('Bad EX2 header')
    if bps != 16:
        raise ValueError('Only 16-bit PCM supported in this demo')
    if not sr or not ch or k > 16 or frames * ch * (k + 1) > 8 * (len(data) - HDR_SIZE):
        raise ValueError("Invalid EX2 dimensions or truncated payload")
    br = BitReader(data[HDR_SIZE:])
    total = frames * ch
    z = rice_decode(total, k, br)
    x = zigzag_decode_int32(z).astype(np.int16)
    audio = x.reshape(frames, ch)
    if ver == 2:
        audio = np.cumsum(audio, axis=0, dtype=np.int64).astype(np.int16)
    if ch == 1:
        audio = audio[:, 0]
    wavfile.write(out_wav_path, sr, audio)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Lossless Rice coding for signed 16-bit PCM WAV")
    parser.add_argument("mode", choices=["encode", "decode"])
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--k", type=int, choices=range(17), help="Override automatic selection with 0 to 16")
    args = parser.parse_args()
    if args.mode == "encode":
        used = encode_wav_to_ex2(args.input, args.k, args.output)
        size = Path(args.output).stat().st_size
        original = Path(args.input).stat().st_size
        print(f"k={used}, {original} WAV bytes to {size} EX2 bytes, size ratio {size / original:.3f}")
    else:
        decode_ex2_to_wav(args.input, args.output)
