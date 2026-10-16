"""Losslessly place intact generated rows into square cells; never redraw pixels.

The image tool returned a 1265 x 1243 canvas with unequal row spacing. Keep the
unaltered output in reactions-generated.png; page-mascot requires a square 3x3.
Run from this directory with Pillow installed, before the skill's normal builder.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
source = Image.open(root / 'reactions-generated.png').convert('RGBA')
assert source.size == (1265, 1243), 'Review new source geometry before normalizing'
tile = 422
result = Image.new('RGBA', (tile * 3, tile * 3))
# Full transparent gaps separate these intact source rows. Use one translation
# per row (no resizing) so expression/head/body proportions are preserved.
for row, (top, bottom, base) in enumerate([(100, 470, 435), (500, 850, 817), (870, 1243, 1195)]):
    for col in range(3):
        left, right = round(col * source.width / 3), round((col + 1) * source.width / 3)
        bust = source.crop((left, top, right, bottom))
        y = row * tile + 359 - (base - top)
        result.alpha_composite(bust, (col * tile, y))
result.save(root / 'reactions.png')
