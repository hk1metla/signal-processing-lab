"""Exercise the real recovered codec with synthetic, non-copyrighted PCM."""
import tempfile
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from rice_codec import encode_wav_to_ex2,decode_ex2_to_wav
rng=np.random.default_rng(42);checks=0
with tempfile.TemporaryDirectory() as d:
    d=Path(d)
    for channels in (1,2):
        for extreme in (False,True):
            samples=rng.integers(-2048,2048,(128,channels),dtype=np.int16)
            if extreme:samples[:4,:]=np.array([-32768,-1,0,32767],dtype=np.int16)[:,None]
            if channels==1:samples=samples[:,0]
            wavfile.write(d/'in.wav',16000,samples)
            for k in (2,4,8,12):
                encode_wav_to_ex2(str(d/'in.wav'),k,str(d/'out.ex2'))
                decode_ex2_to_wav(str(d/'out.ex2'),str(d/'decoded.wav'))
                sr,recovered=wavfile.read(d/'decoded.wav')
                assert sr==16000 and np.array_equal(samples,recovered)
                checks+=1
print(f'{checks} lossless PCM round trips passed')
