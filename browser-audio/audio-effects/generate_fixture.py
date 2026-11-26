from pathlib import Path
import wave,math,struct
p=Path(__file__).parent/'synthetic-chirp.wav'
with wave.open(str(p),'wb') as f:
 f.setnchannels(1);f.setsampwidth(2);f.setframerate(22050)
 f.writeframes(b''.join(struct.pack('<h',int(6000*math.sin(2*math.pi*(220*t/22050+110*(t/22050)**2)))) for t in range(66150)))
print(p.name)
