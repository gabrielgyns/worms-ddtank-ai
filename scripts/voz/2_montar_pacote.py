# Monta o pacote: limpa (grave, compressor, volume igual), apara e junta as falas num mp3 só.
# A lista LINES segue a ordem do roteiro (docs/vozes.md); a saída JSON vira src/core/voicepacks.ts.
# Uso: python -I 2_montar_pacote.py <pasta de trabalho> <saida.mp3> <saida.json>
import sys, json, subprocess, wave
import numpy as np
S, OUT_MP3, OUT_JSON = sys.argv[1], sys.argv[2], sys.argv[3]
segs = json.load(open(f'{S}/vox/segments.json'))
# 2 ruídos curtos e baixinhos entre as falas (não são falas)
segs = [s for s in segs if s['i'] not in (38, 43)]
LINES = [
 ('turn','Minha vez!'),('turn','Deixa comigo!'),('turn','Hora do show!'),
 ('fire','Toma!'),('fire','Lá vai!'),('fire','Fogo!'),('fire','Segura essa!'),
 ('hit','Na mosca!'),('hit','Bem feito!'),('hit','Hehehe!'),
 ('kill','Próximo!'),('kill','Tchau, tchau!'),('kill','Foi mal… só que não.'),
 ('miss','Errei!'),('miss','Ah, não!'),('miss','Era pra ser assim mesmo…'),
 ('self','Ops…'),('self','Ninguém viu isso.'),
 ('friendly','Fogo amigo?!'),('friendly','Ei, eu sou do seu time!'),
 ('ouch','Ai!'),('ouch','Ui!'),('big','AAAAI!'),('ouch','Essa doeu!'),
 ('low','Socorro!'),('low','Tô mal…'),
 ('fall','Aaaaaaa!'),('drown','Glub glub!'),
 ('death','Tchau!'),('death','Fui…'),
 ('win','Vitória!'),('win','Somos os melhores!'),('lose','Perdemos…'),
 ('hurry','Rápido, rápido!'),('crate','Oba, presente!'),
 ('sheep','Bééé!'),('airstrike','Ataque aéreo!'),('banana','Banana!'),('teleport','Teletransporte!'),
 ('laugh','Muahaha!'),('relief','Ufa!'),('grumpy','Hmpf!'),('whistle','♪ fiu-fiu ♪'),
]
assert len(segs) == len(LINES), (len(segs), len(LINES))
SR = 44100
w = wave.open(f'{S}/vox/full48k.wav'); src_sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
gap = np.zeros(int(SR * 0.35), dtype=np.float32)
parts, clips, pos = [gap], [], len(gap)
for (cue, text), s in zip(LINES, segs):
    a, b = int(max(0, s['t0'] - 0.02) * src_sr), int((s['t1'] + 0.06) * src_sr)
    raw = x[a:b]
    # filtro de grave, compressor e volume igualado (falas baixas sobem, gritos não estouram)
    p = subprocess.run(['ffmpeg','-v','error','-f','f32le','-ar',str(src_sr),'-ac','1','-i','-',
        '-af','highpass=f=90,lowpass=f=9000,acompressor=threshold=-24dB:ratio=4:attack=5:release=80:makeup=6dB,'
              'loudnorm=I=-16:TP=-2:LRA=7,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,'
              'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,'
              'afade=t=in:d=0.006',
        '-ar',str(SR),'-f','f32le','-'], input=raw.tobytes(), capture_output=True, check=True)
    y = np.frombuffer(p.stdout, dtype=np.float32).copy()
    n = len(y); fo = min(int(SR*0.03), n//4)
    y[n-fo:] *= np.linspace(1, 0, fo)
    y = y / max(1e-4, np.abs(y).max()) * 0.89
    clips.append({'cue': cue, 'text': text, 'start': round(pos / SR, 4), 'dur': round(n / SR, 4)})
    parts += [y, gap]; pos += n + len(gap)
allx = np.concatenate(parts)
subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-b:a','64k',OUT_MP3],
               input=allx.astype(np.float32).tobytes(), check=True)
json.dump(clips, open(OUT_JSON,'w'), ensure_ascii=False, indent=1)
print(len(clips), 'falas,', round(len(allx)/SR,1), 's no total')
for c in clips: print(f"{c['cue']:9s} {c['dur']:.2f}s {c['text']}")
