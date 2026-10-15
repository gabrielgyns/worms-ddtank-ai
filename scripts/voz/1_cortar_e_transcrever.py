# Corta a gravação nos silêncios e transcreve cada trecho (Whisper via sherpa-onnx, roda offline).
# Uso: python -I 1_cortar_e_transcrever.py <pasta de trabalho>  (espera <pasta>/vox/full16k.wav e o modelo em <pasta>/asr/)
import sys, wave, json
import numpy as np
import sherpa_onnx
S = sys.argv[1]
w = wave.open(f'{S}/vox/full16k.wav'); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
hop = int(sr * 0.02)
rms = np.array([np.sqrt(np.mean(x[i:i+hop]**2)) for i in range(0, len(x) - hop, hop)])
floor = np.percentile(rms, 20)
peak = np.percentile(rms, 99)
thr = max(floor * 4, peak * 0.06)
print('floor %.4f peak %.4f thr %.4f' % (floor, peak, thr))
on = rms > thr
segs = []
i = 0
while i < len(on):
    if on[i]:
        j = i
        while j < len(on) and on[j]: j += 1
        segs.append([i, j]); i = j
    else: i += 1
# junta pedaços separados por menos de 0.3 s (uma fala com respiração no meio)
merged = []
for a, b in segs:
    if merged and a - merged[-1][1] < 15: merged[-1][1] = b
    else: merged.append([a, b])
merged = [s for s in merged if s[1] - s[0] >= 6]
rec = sherpa_onnx.OfflineRecognizer.from_whisper(
    encoder=f'{S}/asr/sherpa-onnx-whisper-small/small-encoder.int8.onnx',
    decoder=f'{S}/asr/sherpa-onnx-whisper-small/small-decoder.int8.onnx',
    tokens=f'{S}/asr/sherpa-onnx-whisper-small/small-tokens.txt',
    language='pt', task='transcribe', num_threads=4)
out = []
for k, (a, b) in enumerate(merged):
    t0, t1 = max(0, a * 0.02 - 0.08), b * 0.02 + 0.12
    seg = x[int(t0 * sr):int(t1 * sr)]
    st = rec.create_stream(); st.accept_waveform(sr, seg); rec.decode_stream(st)
    txt = st.result.text.strip()
    out.append({'i': k, 't0': round(t0, 2), 't1': round(t1, 2), 'peak': round(float(np.abs(seg).max()), 3), 'text': txt})
    print(f'{k:3d} {t0:7.2f}-{t1:7.2f} ({t1-t0:4.2f}s) pk {np.abs(seg).max():.2f}  {txt}')
json.dump(out, open(f'{S}/vox/segments.json', 'w'), ensure_ascii=False, indent=1)
