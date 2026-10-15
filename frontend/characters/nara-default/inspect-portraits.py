"""Local atlas/framing QA only; these previews are not browser screenshots."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
public = root.parents[1] / 'public' / 'mascots'
out = root / 'verification'
out.mkdir(exist_ok=True)
frames = []
for kind in ['directions', 'reactions']:
    sheet = Image.open(public / f'nara-default-{kind}.webp').convert('RGBA')
    tile = sheet.width // 3
    frames.append([sheet.crop((i % 3 * tile, i // 3 * tile, (i % 3 + 1) * tile, (i // 3 + 1) * tile)) for i in range(9)])

contact = Image.new('RGB', (9 * 160, 2 * 180), '#faf8f5')
draw = ImageDraw.Draw(contact)
for row, cells in enumerate(frames):
    for col, frame in enumerate(cells):
        contact.paste(frame.resize((140, 140)), (col * 160 + 10, row * 180 + 20), frame.resize((140, 140)))
        draw.text((col * 160 + 10, row * 180 + 160), f'{row}:{col}', fill='#0d2820')
contact.save(out / 'atlas-contact.png')
lr = Image.new('RGB', (720, 380), '#faf8f5')
for n, index in enumerate([3, 5]):
    lr.paste(frames[0][index], (n * 360, 20), frames[0][index])
ImageDraw.Draw(lr).text((10, 2), 'Viewer left                         Viewer right', fill='#0d2820')
lr.save(out / 'viewer-left-right.png')

scale = 1.2
metrics = {'portraitScale': scale, 'clippedOpaquePixels': {}, 'sizes': [32, 40, 48, 88]}
for row, cells in enumerate(frames):
    for col, frame in enumerate(cells):
        a = np.array(frame)[..., 3] > 40
        y, x = np.where(a)
        px = (x / frame.width - 0.5) * scale + 0.5
        py = (y / frame.height - 0.5) * scale + 0.5
        metrics['clippedOpaquePixels'][f'{row}:{col}'] = int(((px < 0) | (px >= 1) | (py < 0) | (py >= 1)).sum())

preview = Image.new('RGB', (900, 360), '#faf8f5')
for theme, bg in enumerate(['#faf8f5', '#071914']):
    ImageDraw.Draw(preview).rectangle((0, theme * 180, 900, (theme + 1) * 180), fill=bg)
    x = 20
    for size in metrics['sizes']:
        for frame in [frames[0][4], frames[1][7], frames[1][8]]:
            canvas = Image.new('RGBA', (size, size))
            scaled = frame.resize((round(size * scale), round(size * scale)), Image.Resampling.LANCZOS)
            offset = round((size - scaled.width) / 2)
            canvas.alpha_composite(scaled, (offset, offset))
            preview.paste(canvas, (x, theme * 180 + 50), canvas)
            x += size + 15
preview.save(out / 'portrait-sizes.png')
base = np.array(frames[0][4])[..., 3]
blink = np.array(frames[1][0])[..., 3]
overlay = np.zeros((360, 360, 4), dtype=np.uint8)
overlay[..., 0] = base
overlay[..., 1] = blink
overlay[..., 3] = np.maximum(base, blink)
Image.fromarray(overlay).save(out / 'alignment-overlay.png')
(out / 'framing.json').write_text(json.dumps(metrics, indent=2) + '\n')
print(json.dumps(metrics, indent=2))
