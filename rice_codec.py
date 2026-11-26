import numpy as np
import struct, os
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

def encode_wav_to_ex2(wav_path: str, k: int, out_path: str):
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
    payload = rice_encode(z, k)
    hdr = struct.pack(HDR_FMT, b'EX2', 1, int(sr), int(ch), 16, int(k), int(frames))
    with open(out_path, 'wb') as f:
        f.write(hdr)
        f.write(payload)

def decode_ex2_to_wav(ex2_path: str, out_wav_path: str):
    data = Path(ex2_path).read_bytes()
    if len(data) < HDR_SIZE:
        raise ValueError('EX2 too small')
    magic, ver, sr, ch, bps, k, frames = struct.unpack(HDR_FMT, data[:HDR_SIZE])
    if magic != b'EX2' or ver != 1:
        raise ValueError('Bad EX2 header')
    if bps != 16:
        raise ValueError('Only 16-bit PCM supported in this demo')
    br = BitReader(data[HDR_SIZE:])
    total = frames * ch
    z = rice_decode(total, k, br)
    x = zigzag_decode_int32(z).astype(np.int16)
    audio = x if ch == 1 else x.reshape(frames, ch)
    wavfile.write(out_wav_path, sr, audio)

def file_bytes(path):
    return os.path.getsize(path) if Path(path).exists() else 0

def percent_compression(orig, comp):
    return 100.0 * (1.0 - comp / orig) if orig > 0 else 0.0

def pick(name_like):
    for n, p in cands.items():
        if name_like in n:
            return p
    return None

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description='Rice coding for signed 16-bit PCM WAV')
    parser.add_argument('mode',choices=['encode','decode'])
    parser.add_argument('input');parser.add_argument('output')
    parser.add_argument('--k',type=int,default=4)
    args=parser.parse_args()
    if not 0<=args.k<=16:parser.error('k must be in [0,16]')
    if args.mode=='encode':encode_wav_to_ex2(args.input,args.k,args.output)
    else:decode_ex2_to_wav(args.input,args.output)
