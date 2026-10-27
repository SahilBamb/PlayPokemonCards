"""Render a vertical pack opening Short from the saved Grok clips and UI capture.
Requires ffmpeg/ffprobe plus Python pillow and numpy. No generation API calls.
"""
from pathlib import Path
import json, math, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1]).resolve()
plan = json.loads((root / 'edit-plan.json').read_text())
record = json.loads((root / 'recording-metadata.json').read_text())
assets = root / 'render-assets'
assets.mkdir(exist_ok=True)
out = root / 'output'
out.mkdir(exist_ok=True)
font_path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
regular_path = '/System/Library/Fonts/Supplemental/Arial.ttf'

def run(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', *map(str, args)], check=True)

def text_center(draw, text, y, size, fill, stroke=0):
    font = ImageFont.truetype(font_path, size)
    while draw.textbbox((0, 0), text, font=font, stroke_width=stroke)[2] > 1020:
        size -= 1
        font = ImageFont.truetype(font_path, size)
    box = draw.textbbox((0, 0), text, font=font, stroke_width=stroke)
    x = (1080 - (box[2] - box[0])) / 2 - box[0]
    draw.text((x, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=(8, 11, 20, 255))

# A compact caption track leaves the card image unobscured.
blank = Image.new('RGBA', (1080, 120))
blank.save(assets / 'caption-blank.png')
files = []
previous = 0.0
for index, (start, end, text) in enumerate(plan['captions']):
    if start > previous:
        files.append(('caption-blank.png', start - previous))
    image = Image.new('RGBA', (1080, 120))
    draw = ImageDraw.Draw(image)
    color = '#ffe29b' if start >= 21.9 else '#ffffff'
    text_center(draw, text, 26, 67 if start >= 21.9 else 61, color, 7)
    name = f'caption-{index:02d}.png'
    image.save(assets / name)
    files.append((name, end - start))
    previous = end
if previous < plan['duration']:
    files.append(('caption-blank.png', plan['duration'] - previous))
concat = ['ffconcat version 1.0']
for filename, duration in files:
    concat.extend([f"file '{filename}'", f'duration {duration:.6f}'])
concat.append("file 'caption-blank.png'")
(assets / 'captions.ffconcat').write_text('\n'.join(concat) + '\n')

def srt_time(value):
    ms = round(value * 1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
(root / 'output' / 'playpokemoncards-charizard-short.srt').write_text('\n\n'.join(
    f'{i+1}\n{srt_time(start)} --> {srt_time(end)}\n{text}'
    for i, (start, end, text) in enumerate(plan['captions'])
) + '\n')

branding = Image.new('RGBA', (1080, 1920))
draw = ImageDraw.Draw(branding)
draw.rounded_rectangle((24, 18, 398, 67), radius=14, fill=(10, 16, 30, 205), outline=(242, 137, 191, 160), width=2)
draw.text((42, 29), 'PLAY POKÉMON CARDS', font=ImageFont.truetype(font_path, 27), fill='#fff6ff')
draw.rounded_rectangle((803, 23, 1056, 63), radius=12, fill=(10, 16, 30, 190))
draw.text((824, 33), 'BASE SET  •  1999', font=ImageFont.truetype(font_path, 22), fill='#ffe2a0')
for y in range(600, 608):
    draw.line((0, y, 1080, y), fill=(235, 130, 185, 255))
for y in range(1810, 1920):
    alpha = int(235 * ((y-1810)/110)**0.7)
    draw.line((0, y, 1080, y), fill=(8, 12, 23, alpha))
text_center(draw, 'playpokemoncards.pages.dev', 1858, 30, '#ffffff')
text_center(draw, 'AI streamer  •  Seeded pack simulation', 1898, 18, '#c1c9dc')
branding.save(assets / 'branding.png')

# Original synthesized effects, mixed quietly beneath the generated dialogue.
rate = 48000
mix = np.zeros((int(plan['duration'] * rate), 2), dtype=np.float64)
rng = np.random.default_rng(1715)
def add(sound, start, gain=1.0, pan=0.0):
    offset = int(start * rate)
    count = min(len(sound), len(mix)-offset)
    if count <= 0: return
    sound = sound[:count] * gain
    mix[offset:offset+count,0] += sound * math.sqrt((1-pan)/2)
    mix[offset:offset+count,1] += sound * math.sqrt((1+pan)/2)
def tone(freq, seconds, gain):
    t = np.arange(int(seconds * rate)) / rate
    envelope = np.sin(np.pi*np.minimum(1, t/seconds))**2 * np.exp(-t*5)
    return np.sin(2*np.pi*freq*t) * envelope * gain
rip = rng.normal(0, 1, int(.36*rate))
rip = np.convolve(rip, np.ones(5)/5, mode='same') * np.hanning(len(rip)) * .08
add(rip, 4.47)
for item in plan['reveals']:
    if item['index'] < 10:
        add(tone(830 + item['index']*22, .075, .065), item['at']+.31)
for index, frequency in enumerate([523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]):
    add(tone(frequency, .5, .075), 21.87 + index*.075, pan=(-.45 if index%2 else .45))
add(tone(73.4, .4, .13), 21.87)
with wave.open(str(assets/'effects.wav'), 'wb') as wav:
    wav.setnchannels(2); wav.setsampwidth(2); wav.setframerate(rate)
    wav.writeframes((np.clip(mix,-1,1)*32767).astype('<i2').tobytes())

print('Rendering the three matched reaction clips', flush=True)
reaction_inputs = []
for name in ['01-opening.mp4', '02-build.mp4', '03-charizard.mp4']:
    reaction_inputs.extend(['-i', root/'sources'/name])
filters = []
for i in range(3):
    filters.extend([
        f'[{i}:v:0]trim=duration=10,setpts=PTS-STARTPTS,crop=900:500:190:0,scale=1080:600:flags=lanczos,fps=30,setsar=1[v{i}]',
        f'[{i}:a:0]atrim=duration=10,asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,aformat=channel_layouts=stereo[a{i}]'
    ])
filters.extend(['[v0][v1][v2]concat=n=3:v=1:a=0[video]', '[a0][a1][a2]concat=n=3:v=0:a=1[audio]'])
run(*reaction_inputs, '-filter_complex', ';'.join(filters), '-map', '[video]', '-map', '[audio]', '-t', 30,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', 18, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', root/'recordings'/'reaction-camera.mp4')

print('Retiming the real website opening to the speech', flush=True)
raw = root/'recordings'/'website-raw.webm'
trim = record['trimStart']
popup = next(event['rawAt'] for event in record['events'] if event['name']=='popup')
opening = plan['openingRetimeStart']
first = record['firstRevealRaw']
post_end = plan['duration'] + record['postOpeningOffset']
speed = (plan['firstReveal'] - opening) / (first - opening)
segments = [
    f'[0:v]trim=start={trim}:end={trim+popup},setpts=PTS-STARTPTS,crop=720:864:0:0,scale=1080:1296:flags=lanczos,fps=30,setsar=1[g0]',
    f'[0:v]trim=start={trim+popup}:end={trim+opening},setpts=PTS-STARTPTS,crop=400:480:160:400,scale=1080:1296:flags=lanczos,fps=30,setsar=1[g1]',
    f'[0:v]trim=start={trim+opening}:end={trim+first},setpts=(PTS-STARTPTS)*{speed},crop=400:480:160:400,scale=1080:1296:flags=lanczos,fps=30,setsar=1[g2]',
    f'[0:v]trim=start={trim+first}:end={trim+post_end},setpts=PTS-STARTPTS,crop=400:480:160:286,scale=1080:1296:flags=lanczos,fps=30,setsar=1[g3]',
    '[g0][g1][g2][g3]concat=n=4:v=1:a=0,tpad=stop_mode=clone:stop_duration=0.15,trim=duration=30[game]'
]
run('-i', raw, '-filter_complex', ';'.join(segments), '-map', '[game]', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', 17, '-pix_fmt', 'yuv420p', '-r', 30, '-movflags', '+faststart', root/'recordings'/'gameplay-edited.mp4')

print('Compositing the final 1080 by 1920 Short', flush=True)
final = out/'playpokemoncards-charizard-short.mp4'
composition = ';'.join([
    'color=c=0x090e1a:s=1080x1920:r=30:d=30[base]',
    '[base][1:v]overlay=x=0:y=608[game]',
    '[game][0:v]overlay=x=0:y=0[face]',
    '[face][2:v]overlay=x=0:y=480:format=auto[captioned]',
    '[captioned][3:v]overlay=x=0:y=0:format=auto,format=yuv420p[video]',
    '[0:a][4:a]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=false[audio]'
])
run('-i', root/'recordings'/'reaction-camera.mp4', '-i', root/'recordings'/'gameplay-edited.mp4',
    '-f', 'concat', '-safe', 0, '-i', assets/'captions.ffconcat', '-loop', 1, '-i', assets/'branding.png', '-i', assets/'effects.wav',
    '-filter_complex', composition, '-map', '[video]', '-map', '[audio]', '-t', 30, '-r', 30,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', 18, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', '-metadata', 'title=One Base Set Pack', '-metadata', 'comment=Original AI streamer reacting to a seeded simulation recorded from PlayPokemonCards', final)
run('-i', final, '-vf', 'fps=1/2.5,scale=270:480,tile=3x4', '-frames:v', 1, out/'contact-sheet.jpg')
run('-ss', 22.4, '-i', final, '-frames:v', 1, out/'playpokemoncards-charizard-cover.jpg')
print(final, flush=True)
