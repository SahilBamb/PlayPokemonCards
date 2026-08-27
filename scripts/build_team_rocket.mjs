// Builds Team Rocket trainer records (same shape as trainerClasses) into:
//   scripts/team_rocket_raw.json
//   src/data/teamRocket.js
// Run: npm run scrape:team-rocket
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const UA = 'cardGame-scraper/1.0 (local Pokémon TCG sandbox; personal use)'
const ARCHIVES_API = 'https://archives.bulbagarden.net/w/api.php'

/** Curated Team Rocket trainers supplied by project (image URLs / file pages). */
const ENTRIES = [
  {
    id: 'team-rocket-grunt-f',
    name: 'Team Rocket Grunt',
    gender: 'F',
    game: null,
    notes: 'Team Rocket',
    image:
      'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/7cef25d8-f84e-45df-82da-48cc8a866527/dhi091q-e544eb7e-a205-4e8c-bde2-74f085149425.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi83Y2VmMjVkOC1mODRlLTQ1ZGYtODJkYS00OGNjOGE4NjY1MjcvZGhpMDkxcS1lNTQ0ZWI3ZS1hMjA1LTRlOGMtYmRlMi03NGYwODUxNDk0MjUucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.E315cbys3jj9_qrGnA0Ftq8oKUt4TFtgTsa8fCuNQ8w',
    sourceUrl: null,
    fileName: null,
  },
  {
    id: 'team-rocket-grunt-m',
    name: 'Team Rocket Grunt',
    gender: 'M',
    game: null,
    notes: 'Team Rocket',
    image:
      'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/7cef25d8-f84e-45df-82da-48cc8a866527/dhi0910-b55bd083-c923-4fb7-85a1-a3b95b9f63a6.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi83Y2VmMjVkOC1mODRlLTQ1ZGYtODJkYS00OGNjOGE4NjY1MjcvZGhpMDkxMC1iNTViZDA4My1jOTIzLTRmYjctODVhMS1hM2I5NWI5ZjYzYTYucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.jDwUqjhjlA0zroTYQQ3SpD8G1EoPXtPo--898y_HHRc',
    sourceUrl: null,
    fileName: null,
  },
  {
    id: 'team-rocket-imposter-professor-elm',
    name: 'Team Rocket Imposter Professor Elm',
    gender: null,
    game: 'Gold, Silver, Crystal / HeartGold and SoulSilver',
    notes: 'Team Rocket',
    image:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQsdu__JOVlfoXvVFidmnd7Wp5p7hBUQipCif-2WL1qEWcR5rcCYgz8LdM&s=10',
    sourceUrl: null,
    fileName: null,
  },
  {
    id: 'team-rocket-executive-proton',
    name: 'Team Rocket Executive Proton',
    gender: 'M',
    game: 'HeartGold and SoulSilver',
    notes: 'Team Rocket',
    image:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRqWvH8Oo1hadiTcLTSvk2r6cU9PrbO1JNzDNz4PhRiMQ&s=10',
    sourceUrl: null,
    fileName: null,
  },
  {
    id: 'team-rocket-executive-ariana',
    name: 'Team Rocket Executive Ariana',
    gender: 'F',
    game: 'HeartGold and SoulSilver',
    notes: 'Team Rocket',
    image:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbApFLM18DG5mDqJauhJOWNV8hFaJeATwOrtMfCSIKRw&s=10',
    sourceUrl: null,
    fileName: null,
  },
  {
    id: 'team-rocket-executive-petrel',
    name: 'Team Rocket Executive Petrel',
    gender: 'M',
    game: 'HeartGold and SoulSilver',
    notes: 'Team Rocket',
    image:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRGbprEqtQBuXyPEzO2u7tEyf-HhyzJltLACco2ilGwRQ&s=10',
    sourceUrl: null,
    fileName: null,
  },
  {
    id: 'team-rocket-grunt-m-alt',
    name: 'Team Rocket Grunt',
    gender: 'M',
    game: 'HeartGold and SoulSilver',
    notes: 'Team Rocket',
    image:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJGn8cYEw0p8mgSyWOwqdCCcIl4UJBzmR5Y-HzXwBMaPEczFPZwBMV7Xc&s=10',
    sourceUrl: null,
    fileName: null,
  },
  {
    id: 'team-rocket-grunt-f-hgss',
    name: 'Team Rocket Grunt',
    gender: 'F',
    game: 'HeartGold and SoulSilver',
    notes: 'Team Rocket',
    image:
      'https://static.wikia.nocookie.net/evilbabes/images/f/f0/2_-_Rocket_Grunt_HGSS.png/revision/latest/scale-to-width-down/457?cb=20160227215227',
    sourceUrl:
      'https://static.wikia.nocookie.net/evilbabes/images/f/f0/2_-_Rocket_Grunt_HGSS.png/revision/latest',
    fileName: '2_-_Rocket_Grunt_HGSS.png',
  },
  {
    id: 'team-rocket-grunts-tag-hgss',
    name: 'Team Rocket Grunts Tag Team',
    gender: null,
    game: 'HeartGold and SoulSilver',
    notes: 'Team Rocket; Male and Female',
    bulbaFile: 'File:HeartGold SoulSilver Team Rocket Grunt.png',
    image: null,
    sourceUrl:
      'https://archives.bulbagarden.net/wiki/File:HeartGold_SoulSilver_Team_Rocket_Grunt.png',
    fileName: 'HeartGold SoulSilver Team Rocket Grunt.png',
  },
  {
    id: 'team-rocket-grunts-tag-frlg',
    name: 'Team Rocket Grunts Tag Team',
    gender: null,
    game: 'FireRed and LeafGreen',
    notes: 'Team Rocket; Male and Female',
    bulbaFile: 'File:FireRed LeafGreen Team Rocket grunts.png',
    image: null,
    sourceUrl:
      'https://archives.bulbagarden.net/wiki/File:FireRed_LeafGreen_Team_Rocket_grunts.png',
    fileName: 'FireRed LeafGreen Team Rocket grunts.png',
  },
]

function cleanImageUrl(url) {
  if (!url) return null
  // Prefer stable /revision/latest for Wikia; drop scale + cache buster
  const m = url.match(
    /^(https:\/\/static\.wikia\.nocookie\.net\/[^/]+\/images\/[^?]+?\/revision\/latest)/,
  )
  if (m) return m[1]
  return url
}

async function resolveBulbaUrls(fileTitles) {
  if (!fileTitles.length) return new Map()
  const u = new URL(ARCHIVES_API)
  u.searchParams.set('action', 'query')
  u.searchParams.set('titles', fileTitles.join('|'))
  u.searchParams.set('prop', 'imageinfo')
  u.searchParams.set('iiprop', 'url')
  u.searchParams.set('format', 'json')
  const res = await fetch(u, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Archives API ${res.status}`)
  const j = await res.json()
  const map = new Map()
  for (const page of Object.values(j.query?.pages || {})) {
    if (page.title && page.imageinfo?.[0]?.url) {
      map.set(page.title, page.imageinfo[0].url)
    }
  }
  return map
}

async function main() {
  const bulbaTitles = ENTRIES.filter((e) => e.bulbaFile).map((e) => e.bulbaFile)
  const bulbaUrls = await resolveBulbaUrls(bulbaTitles)

  const trainers = ENTRIES.map((e) => {
    let image = e.image
    if (e.bulbaFile) image = bulbaUrls.get(e.bulbaFile) || image
    image = cleanImageUrl(image)

    return {
      id: e.id,
      name: e.name,
      gender: e.gender,
      game: e.game,
      fileName: e.fileName,
      sourceUrl: e.sourceUrl || e.image || image,
      notes: e.notes,
      image,
    }
  })

  const dump = {
    source: 'curated Team Rocket trainer image list',
    scrapedAt: new Date().toISOString(),
    trainers,
  }

  const rawPath = path.join(here, 'team_rocket_raw.json')
  fs.writeFileSync(rawPath, JSON.stringify(dump, null, 2) + '\n')

  const mod =
    '// Auto-generated by scripts/build_team_rocket.mjs — do not edit by hand.\n' +
    'const TEAM_ROCKET = ' +
    JSON.stringify(trainers, null, 2) +
    '\n\nexport default TEAM_ROCKET\n'
  const outPath = path.join(here, '..', 'src', 'data', 'teamRocket.js')
  fs.writeFileSync(outPath, mod)

  console.log('Wrote', trainers.length, 'Team Rocket trainers')
  for (const t of trainers) {
    console.log(' ', t.id, t.image ? '✓' : 'MISSING')
  }
  console.log('→', rawPath)
  console.log('→', outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
