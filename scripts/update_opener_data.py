"""Refresh the Card Opener catalog, cached market values, and pack photographs.

TCGCSV is fetched by this maintenance script only, never by players' browsers.
Responses are cached against the provider's daily build timestamp.
"""
from pathlib import Path
from datetime import datetime, timezone
import json
import re
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/card-opener'
OUT = ROOT / 'src/data'
PACKS = ROOT / 'public/boosterpacks'
SETS = {'base1': 604, 'jungle': 635, 'fossil': 630, 'rocket': 1373, 'gym1': 1441, 'gym2': 1440}
NAMES = {'base1': 'Base Set', 'jungle': 'Jungle', 'fossil': 'Fossil', 'rocket': 'Team Rocket', 'gym1': 'Gym Heroes', 'gym2': 'Gym Challenge'}
AGENT = 'PlayPokemonCardsCardOpener/1.0'
CACHE.mkdir(parents=True, exist_ok=True)
PACKS.mkdir(parents=True, exist_ok=True)

def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': AGENT})
    with urllib.request.urlopen(request, timeout=35) as response:
        data = response.read()
    time.sleep(.12)
    return data

updated = download('https://tcgcsv.com/last-updated.txt').decode().strip()
cache_stamp = re.sub(r'[^0-9]', '', updated)
def cached(group, kind):
    path = CACHE / f'{group}-{kind}-{cache_stamp}.json'
    if not path.exists():
        path.write_bytes(download(f'https://tcgcsv.com/tcgplayer/3/{group}/{kind}'))
    response = json.loads(path.read_text())
    if not response.get('success') or response.get('errors'):
        raise RuntimeError(f'TCGCSV returned an error for {group}/{kind}')
    return response['results']

catalog, values, packs = [], {}, {}
for set_id, group in SETS.items():
    products = cached(group, 'products')
    prices = cached(group, 'prices')
    product_by_number = {}
    for product in products:
        number = next((f['value'] for f in product.get('extendedData', []) if f['name'] == 'Number'), '')
        if re.fullmatch(r'\d+/\d+', number.strip()):
            product_by_number.setdefault(int(number.split('/')[0]), []).append(product)
    price_by_product = {}
    for price in prices:
        price_by_product.setdefault(price['productId'], {})[price['subTypeName']] = price
    raw_cards = json.loads((ROOT / f'scripts/{set_id}_raw.json').read_text())
    if isinstance(raw_cards, dict):
        raw_cards = raw_cards['data']
    for raw in raw_cards:
        card = {
            'id': raw['id'], 'name': raw['name'], 'set': set_id,
            'number': raw['number'], 'rarity': raw.get('rarity', 'Common'),
            'supertype': raw['supertype'].lower(),
            'image': raw['images']['small'], 'largeImage': raw['images']['large'],
        }
        catalog.append(card)
        is_holo = 'Holo' in card['rarity'] or 'Secret' in card['rarity']
        variants = ['Unlimited Holofoil', 'Holofoil'] if is_holo else ['Unlimited', 'Normal']
        candidates = product_by_number.get(int(card['number']), [])
        for product in candidates:
            available = price_by_product.get(product['productId'], {})
            variant = next((v for v in variants if v in available), None)
            quote = available.get(variant)
            amount = quote.get('marketPrice') if quote else None
            if isinstance(amount, (int, float)) and amount >= 0:
                values[card['id']] = {'usd': amount, 'variant': variant, 'url': product['url']}
                break
    candidates = [p for p in products if 'booster pack' in p['name'].lower()]
    def score(p):
        name = p['name'].lower()
        return len(name) + (1000 if any(s in name for s in ['1st edition', 'shadowless', 'blister', 'heavy', 'light ']) else 0)
    if not candidates:
        raise RuntimeError(f'No booster pack product found for {set_id}')
    product = min(candidates, key=score)
    photo = PACKS / f'{set_id}.jpg'
    if not photo.exists():
        photo.write_bytes(download(product['imageUrl'].replace('_200w', '_in_1000x1000')))
    pack_variants = price_by_product.get(product['productId'], {})
    pack_variant = next((v for v in ['Normal', 'Unlimited'] if isinstance(pack_variants.get(v, {}).get('marketPrice'), (int, float))), None)
    pack_amount = pack_variants.get(pack_variant, {}).get('marketPrice')
    if not isinstance(pack_amount, (int, float)) or pack_amount <= 0:
        raise RuntimeError(f'No market quote for the selected {set_id} booster pack; previous output was not replaced')
    packs[set_id] = {
        'name': product['name'], 'image': f'/boosterpacks/{set_id}.jpg',
        'source': product['url'], 'productId': product['productId'],
        'usd': pack_amount, 'variant': pack_variant,
    }
    matched = sum(c['id'] in values for c in catalog if c['set'] == set_id)
    print(f'{NAMES[set_id]}: {len(raw_cards)} cards, {matched} market values, pack ${pack_amount:.2f}, {product["name"]}')

if not catalog or len(values) < len(catalog) * .85:
    raise RuntimeError('Insufficient price coverage; previous output was not replaced')
snapshot = {
    'source': 'TCGplayer via TCGCSV', 'sourceUrl': 'https://tcgcsv.com/',
    'updatedAt': updated, 'fetchedAt': datetime.now(timezone.utc).isoformat(),
    'currency': 'USD', 'cards': values, 'packs': packs,
}
(OUT / 'openerCards.json').write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + '\n')
(OUT / 'openerPrices.json').write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Saved {len(catalog)} cards and {len(values)} real market quotes. Source build: {updated}')
