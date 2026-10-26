"""Prepare the user-approved reference cutouts and existing pixel sprite views.

Requires Pillow. Run from the repository root. Existing source PNGs are retained
under docs/pixel-grove/sources so reruns do not need network access.
"""
from pathlib import Path
from collections import deque
import urllib.request
from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs/pixel-grove'
OUT = ROOT / 'public/pixel-grove/assets'
SOURCE = DOCS / 'sources'
SOURCE.mkdir(exist_ok=True)
(OUT / 'sprites').mkdir(exist_ok=True)
(OUT / 'card-art').mkdir(exist_ok=True)
reference = Image.open(DOCS / 'reference.jpg').convert('RGBA')

URLS = {
    'pikachu-awake-back': 'sprites/pokemon/back/25.png',
    'pikachu-front': 'sprites/pokemon/versions/generation-v/black-white/25.png',
    'voltorb-front': 'sprites/pokemon/versions/generation-v/black-white/100.png',
    'electrode-front': 'sprites/pokemon/versions/generation-v/black-white/101.png',
}
for name, path in URLS.items():
    dest = SOURCE / f'{name}.png'
    if not dest.exists():
        with urllib.request.urlopen('https://raw.githubusercontent.com/PokeAPI/sprites/master/' + path, timeout=30) as response:
            dest.write_bytes(response.read())

# Outlines are in original 736x1304 reference coordinates. This preserves the
# actual painted pixel clusters rather than redrawing the supplied characters.
OUTLINES = {
    'voltorb-back': [(350,881),(383,881),(383,886),(401,890),(418,904),(430,921),(438,943),(436,969),(425,990),(409,1003),(388,1010),(358,1009),(338,1002),(319,988),(309,972),(302,950),(304,928),(312,909),(326,895)],
    'electrode-back': [(502,882),(534,882),(534,888),(554,890),(573,905),(586,922),(593,944),(592,961),(586,981),(570,995),(551,1005),(518,1007),(496,1000),(480,989),(467,972),(458,953),(458,932),(465,917),(480,901)],
    'koffing-front': [(357,194),(368,191),(381,195),(395,195),(408,203),(419,203),(425,215),(425,226),(435,230),(435,242),(439,248),(436,264),(430,279),(417,291),(403,300),(375,302),(352,297),(335,292),(320,281),(313,269),(307,257),(304,245),(308,231),(316,224),(316,214),(329,210),(337,202),(350,202)],
    'weezing-front': [(142,177),(157,170),(170,177),(183,181),(190,194),(209,193),(226,195),(244,195),(252,192),(268,198),(275,209),(277,226),(284,232),(288,245),(294,254),(291,269),(283,280),(273,291),(258,302),(242,307),(222,306),(204,304),(184,303),(170,298),(158,288),(151,275),(143,275),(138,281),(126,280),(121,271),(124,258),(129,251),(128,235),(122,229),(118,217),(122,204),(128,194),(132,183)],
    'jigglypuff-front': [(408,351),(422,352),(424,374),(430,387),(433,405),(446,410),(449,432),(433,442),(428,462),(429,481),(411,489),(397,484),(349,484),(340,493),(321,496),(307,488),(305,472),(295,460),(284,460),(278,440),(270,438),(267,421),(261,413),(259,402),(262,392),(274,387),(287,393),(294,403),(295,431),(302,431),(300,407),(300,375),(322,373),(343,373),(353,363),(369,360),(382,366),(394,361)],
    'pikachu-sleeping': [(278,588),(297,585),(326,587),(346,590),(348,596),(366,601),(378,613),(383,628),(375,635),(395,643),(419,652),(431,670),(447,671),(448,661),(466,656),(467,637),(455,630),(456,600),(501,594),(528,594),(540,590),(565,587),(565,624),(554,628),(553,643),(523,644),(519,639),(489,640),(487,660),(478,667),(477,687),(496,696),(506,708),(522,712),(535,725),(544,734),(542,747),(531,754),(531,770),(511,777),(513,793),(493,802),(456,810),(426,811),(401,801),(376,804),(365,809),(350,803),(334,806),(324,796),(306,795),(296,804),(276,800),(252,798),(240,787),(230,785),(233,768),(214,755),(208,744),(208,733),(195,726),(194,702),(216,697),(215,678),(208,668),(206,651),(220,640),(242,641),(248,632),(256,612),(267,600)],
}

def cutout(name, remove_green=True):
    polygon = OUTLINES[name]
    mask = Image.new('L', reference.size, 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    image = reference.copy()
    image.putalpha(mask)
    box = mask.getbbox()
    image = image.crop(box)
    # Remove only grass connected to the outside; enclosed green eyes survive.
    if remove_green:
        pixels = image.load()
        width, height = image.size
        visited = set()
        queue = deque((x,y) for x in range(width) for y in [0,height-1])
        queue.extend((x,y) for y in range(height) for x in [0,width-1])
        while queue:
            x,y = queue.popleft()
            if (x,y) in visited or not (0 <= x < width and 0 <= y < height):
                continue
            visited.add((x,y))
            r,g,b,a = pixels[x,y]
            grass = g > r * 1.21 and g > b * 1.06 and g > 92
            if a == 0 or grass:
                pixels[x,y] = (r,g,b,0)
                queue.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
    return image.crop(image.getbbox())

sprites = {name: cutout(name, name != 'pikachu-sleeping') for name in OUTLINES}
for name in URLS:
    image = Image.open(SOURCE / f'{name}.png').convert('RGBA')
    sprites[name] = image.crop(image.getbbox())

# Extract the visible log under Pikachu. A strip of its existing bark texture
# fills the small upper area hidden by the sleeping pose, behind the awake sprite.
log = reference.crop((194,640,546,813))
mask = Image.new('L', log.size, 0)
points = [(11,11),(26,0),(67,7),(111,28),(142,46),(181,72),(229,48),(271,52),(308,66),(339,86),(350,97),(347,110),(332,117),(336,130),(316,140),(320,155),(296,163),(258,171),(229,169),(206,159),(184,163),(168,169),(153,161),(137,165),(126,154),(109,155),(100,164),(79,160),(56,157),(44,146),(35,145),(40,128),(20,115),(14,103),(15,92),(1,85),(0,63),(22,57),(22,38),(13,27)]
ImageDraw.Draw(mask).polygon(points, fill=255)
log.putalpha(mask)
# The sleeping body occludes part of the log. Reuse visible bark pixels there;
# the awake sprite then sits on a complete log without a leftover yellow patch.
wood = reference.crop((362,746,406,769))
repair = Image.new('RGBA',log.size,(0,0,0,0))
for wy in range(0,log.height,wood.height):
    for wx in range(0,log.width,wood.width):
        repair.paste(wood,(wx,wy))
repair_mask = Image.new('L',log.size,0)
ImageDraw.Draw(repair_mask).polygon([(102,17),(177,44),(221,30),(263,46),(248,87),(193,98),(142,77)],fill=255)
log.paste(repair,(0,0),repair_mask)
log.putalpha(mask)
sprites['forest-log'] = log

CELL = 256
def tile(image, size, bottom=229):
    canvas = Image.new('RGBA',(CELL,CELL),(0,0,0,0))
    image = image.copy()
    ratio = min(size[0]/image.width,size[1]/image.height)
    image = image.resize((round(image.width*ratio),round(image.height*ratio)),Image.Resampling.NEAREST)
    canvas.alpha_composite(image,((CELL-image.width)//2,bottom-image.height))
    return canvas

sheet = Image.new('RGBA',(CELL*4,CELL*2),(0,0,0,0))
order = [
    ('voltorb-back',(203,203),224),
    ('electrode-back',(203,203),224),
    ('pikachu-awake-back',(173,198),222),
    ('pikachu-sleeping',(248,210),226),
    ('koffing-front',(214,202),225),
    ('weezing-front',(228,205),225),
    ('jigglypuff-front',(227,207),225),
    ('forest-log',(249,124),231),
]
for i,(name,size,bottom) in enumerate(order):
    packed = tile(sprites[name],size,bottom)
    packed.save(OUT/'sprites'/f'{name}.png',optimize=True)
    sheet.alpha_composite(packed,((i%4)*CELL,(i//4)*CELL))
sheet.save(OUT/'pokemon-sprites.png',optimize=True)

# Square artwork panels use the same generated forest and transparent subjects.
forest = Image.open(OUT/'forest-board.png').convert('RGBA')
art = Image.new('RGB',(CELL*3,CELL*2))
subjects = ['pikachu-front','voltorb-front','electrode-front','koffing-front','weezing-front','jigglypuff-front']
names = ['pikachu','voltorb','electrode','koffing','weezing','jigglypuff']
positions = [(100,390),(140,110),(180,750),(40,900),(250,430),(200,1100)]
for i,(name,subject,(x,y)) in enumerate(zip(names,subjects,positions)):
    backdrop = forest.crop((x,y,x+620,y+620)).resize((CELL,CELL),Image.Resampling.NEAREST)
    backdrop = ImageEnhance.Color(backdrop).enhance(.82)
    overlay = Image.new('RGBA',(CELL,CELL),(0,0,0,0))
    d = ImageDraw.Draw(overlay)
    d.ellipse((63,186,211,213),fill=(11,108,80,65))
    if i in [0,1,2]:
        for sx,sy in [(31,71),(206,36),(221,164),(54,173)]:
            d.rectangle((sx-2,sy-8,sx+2,sy+8),fill=(255,242,149,255))
            d.rectangle((sx-8,sy-2,sx+8,sy+2),fill=(255,242,149,255))
    else:
        d.rectangle((0,0,CELL,CELL),fill=(123,57,149,10))
    backdrop.alpha_composite(overlay)
    character = sprites[subject]
    ratio = min(181/character.width,173/character.height)
    character = character.resize((round(character.width*ratio),round(character.height*ratio)),Image.Resampling.NEAREST)
    backdrop.alpha_composite(character,((CELL-character.width)//2,205-character.height))
    backdrop.convert('RGB').save(OUT/'card-art'/f'{name}.png',optimize=True)
    art.paste(backdrop.convert('RGB'),((i%3)*CELL,(i//3)*CELL))
art.save(OUT/'card-art.png',optimize=True)
print('Prepared 8 transparent sprite tiles and 6 card illustrations, plus both atlases.')
