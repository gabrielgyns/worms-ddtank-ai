# Confere o pacote pronto: transcreve cada fala do mp3 nas posições gravadas e checa se as bordas são silêncio.
# Uso: python -I 3_conferir.py <pasta de trabalho> <pacote.mp3>
import sys, json, subprocess
import numpy as np
import sherpa_onnx
S, MP3 = sys.argv[1], sys.argv[2]
clips = json.load(open(f'{S}/vox/clips.json'))
p = subprocess.run(['ffmpeg','-v','error','-i',MP3,'-ac','1','-ar','16000','-f','f32le','-'], capture_output=True, check=True)
x = np.frombuffer(p.stdout, dtype=np.float32)
M = f'{S}/asr/sherpa-onnx-whisper-small/small-'
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=M+'encoder.int8.onnx', decoder=M+'decoder.int8.onnx', tokens=M+'tokens.txt', language='pt', task='transcribe', num_threads=4)
for c in clips:
    a, b = int(c['start']*16000), int((c['start']+c['dur'])*16000)
    seg = x[a:b]
    # o começo e o fim do recorte devem ser silêncio de verdade (não cortou palavra)
    edge = max(np.abs(x[a-800:a-80]).max(), np.abs(x[b+80:b+800]).max())
    st = rec.create_stream(); st.accept_waveform(16000, seg); rec.decode_stream(st)
    print(f"{c['text'][:24]:24s} | ouvido: {st.result.text.strip()[:30]:30s} | borda {edge:.3f}")
