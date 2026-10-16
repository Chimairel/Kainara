"""Local visual QA only; does not alter source sheets or served atlases."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parents[1]
OUT = HERE / 'verification'
OUT.mkdir(exist_ok=True)
names = ['up-left', 'up', 'up-right', 'left', 'front', 'right', 'down-left', 'down', 'down-right']
expressions = ['blink', 'heart', 'sparkle', 'surprised', 'starstruck (wink)', 'bashful', 'sleepy', 'spiral dizzy', 'delighted']

def cells(path):
    sheet = Image.open(path).convert('RGBA')
    assert sheet.width == sheet.height and sheet.width % 3 == 0
    tile = sheet.width // 3
    return [sheet.crop((i % 3 * tile, i // 3 * tile, (i % 3 + 1) * tile, (i // 3 + 1) * tile)) for i in range(9)]

report = {}
for kind in ['directions', 'reactions']:
    path = HERE / f'{kind}.png'
    source = Image.open(path)
    assert source.mode == 'RGBA'
    margins = []
    for frame in cells(path):
        alpha = np.array(frame.getchannel('A'))
        ys, xs = np.where(alpha > 100)
        margin = [int(xs.min()), int(ys.min()), int(frame.width - 1 - xs.max()), int(frame.height - 1 - ys.max())]
        assert min(margin) >= 2, f'{kind}: cell edge contact {margin}'
        margins.append(margin)
    report[kind] = {'source_size': source.size, 'alpha_zero_fraction': float((np.array(source.getchannel('A')) == 0).mean()), 'cell_margins_LTRB_at_alpha_100': margins}

directions = cells(FRONTEND / 'public' / 'mascots' / 'nara-va-directions.webp')
reactions = cells(FRONTEND / 'public' / 'mascots' / 'nara-va-reactions.webp')
for theme, background, text in [('light', '#faf8f5', '#0d2820'), ('dark', '#071914', '#eff8f3')]:
    contact = Image.new('RGB', (1200, 660), background)
    draw = ImageDraw.Draw(contact)
    for kind, frames, labels in [(0, directions, names), (1, reactions, expressions)]:
        for i, (frame, label) in enumerate(zip(frames, labels)):
            x, y = (kind * 3 + i % 3) * 200, i // 3 * 220
            contact.paste(frame.resize((160, 160), Image.Resampling.LANCZOS), (x + 20, y + 10), frame.resize((160, 160), Image.Resampling.LANCZOS))
            draw.text((x + 16, y + 186), label, fill=text)
    contact.save(OUT / f'contact-{theme}-160.png')

pair = Image.new('RGB', (720, 400), '#faf8f5')
pair.paste(directions[3], (0, 0), directions[3])
pair.paste(directions[5], (360, 0), directions[5])
draw = ImageDraw.Draw(pair)
draw.text((20, 370), 'VIEWER LEFT', fill='#0d2820')
draw.text((380, 370), 'VIEWER RIGHT', fill='#0d2820')
pair.save(OUT / 'viewer-left-right.png')

# A half-opacity overlay makes body and silhouette disagreement inspectable.
overlay = Image.new('RGBA', directions[4].size, '#faf8f5')
for frame in [directions[4], reactions[0]]:
    layer = frame.copy()
    layer.putalpha(layer.getchannel('A').point(lambda value: value // 2))
    overlay = Image.alpha_composite(overlay, layer)
overlay.convert('RGB').save(OUT / 'front-blink-overlay.png')
(OUT / 'source-checks.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
