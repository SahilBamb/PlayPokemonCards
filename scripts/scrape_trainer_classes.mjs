// Scrapes ORAS trainer-class art from Bulbagarden Archives into:
//   scripts/trainer_classes_raw.json
//   src/data/trainerClasses.js
// Run: npm run scrape:trainer-classes
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SOURCE =
  'https://archives.bulbagarden.net/wiki/Category:Art_from_Pokémon_Omega_Ruby_and_Alpha_Sapphire'
const API = 'https://archives.bulbagarden.net/w/api.php'
const WIKI = 'https://archives.bulbagarden.net/wiki/'
const UA = 'cardGame-scraper/1.0 (local Pokémon TCG sandbox; personal use)'
const CATEGORY = 'Category:Art_from_Pokémon_Omega_Ruby_and_Alpha_Sapphire'
const GAME = 'Omega Ruby and Alpha Sapphire'

/** Non-trainer ORAS-prefixed files that live in the same category. */
const ORAS_EXCLUDE =
  /^(ORAS Contest art|ORAS Delta Episode|ORAS DexNav|ORAS Eon Ticket|ORAS Latios|ORAS Mega Rayquaza|ORAS Mirage Spot|ORAS Pokédex|ORAS PokéNav|ORAS Secret Base|ORAS\d)/i

async function api(params) {
  const u = new URL(API)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  u.searchParams.set('format', 'json')
  const res = await fetch(u, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`)
  return res.json()
}

async function listCategoryFiles() {
  const titles = []
  let cmcontinue
  do {
    const params = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: CATEGORY,
      cmtype: 'file',
      cmlimit: '500',
    }
    if (cmcontinue) params.cmcontinue = cmcontinue
    const j = await api(params)
    for (const m of j.query?.categorymembers || []) titles.push(m.title)
    cmcontinue = j.continue?.cmcontinue
  } while (cmcontinue)
  return titles
}

function fileNameFromTitle(title) {
  return title.replace(/^File:/, '')
}

function isTrainerClassFile(fileName) {
  if (/concept art/i.test(fileName)) return false
  if (/^Omega Ruby Alpha Sapphire Team (Aqua|Magma) Grunts\.png$/i.test(fileName)) {
    return true
  }
  if (!/^ORAS .+\.png$/i.test(fileName)) return false
  if (ORAS_EXCLUDE.test(fileName)) return false
  return true
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function parseRecord(fileName) {
  const grunt = fileName.match(
    /^Omega Ruby Alpha Sapphire Team (Aqua|Magma) Grunts\.png$/i,
  )
  if (grunt) {
    const team = grunt[1]
    const name = `Team ${team} Grunt`
    return {
      id: `oras-team-${team.toLowerCase()}-grunt`,
      name,
      gender: null,
      game: GAME,
      fileName,
      sourceUrl: WIKI + 'File:' + encodeURIComponent(fileName).replace(/%20/g, '_'),
      notes: `Team ${team}`,
    }
  }

  // ORAS Ace Trainer F.png → base "Ace Trainer F"
  let base = fileName.replace(/^ORAS\s+/i, '').replace(/\.png$/i, '')
  let gender = null
  const genderMatch = base.match(/^(.*)\s+([MF])$/i)
  if (genderMatch) {
    base = genderMatch[1]
    gender = genderMatch[2].toUpperCase()
  }

  const idParts = ['oras', slugify(base)]
  if (gender) idParts.push(gender.toLowerCase())

  return {
    id: idParts.join('-'),
    name: base,
    gender,
    game: GAME,
    fileName,
    sourceUrl: WIKI + 'File:' + fileName.replace(/ /g, '_'),
    notes: null,
  }
}

async function resolveImageUrls(titles) {
  const urls = new Map()
  const chunkSize = 50
  for (let i = 0; i < titles.length; i += chunkSize) {
    const chunk = titles.slice(i, i + chunkSize)
    const j = await api({
      action: 'query',
      titles: chunk.join('|'),
      prop: 'imageinfo',
      iiprop: 'url',
    })
    const pages = j.query?.pages || {}
    for (const page of Object.values(pages)) {
      const title = page.title
      const url = page.imageinfo?.[0]?.url || null
      if (title) urls.set(title, url)
    }
  }
  return urls
}

async function main() {
  const allTitles = await listCategoryFiles()
  const keptTitles = allTitles.filter((t) => isTrainerClassFile(fileNameFromTitle(t)))
  const imageUrls = await resolveImageUrls(keptTitles)

  const trainers = keptTitles.map((title) => {
    const fileName = fileNameFromTitle(title)
    const base = parseRecord(fileName)
    return {
      ...base,
      image: imageUrls.get(title) || null,
    }
  })

  // Stable sort by name then gender
  trainers.sort((a, b) => {
    const n = a.name.localeCompare(b.name)
    if (n !== 0) return n
    return String(a.gender || '').localeCompare(String(b.gender || ''))
  })

  const missing = trainers.filter((t) => !t.image)
  if (missing.length) {
    console.warn(
      'Warning: missing image URLs for',
      missing.map((t) => t.fileName).join(', '),
    )
  }

  const dump = {
    source: SOURCE,
    scrapedAt: new Date().toISOString(),
    categoryFileCount: allTitles.length,
    trainers,
  }

  const rawPath = path.join(here, 'trainer_classes_raw.json')
  fs.writeFileSync(rawPath, JSON.stringify(dump, null, 2) + '\n')

  const mod =
    '// Auto-generated by scripts/scrape_trainer_classes.mjs — do not edit by hand.\n' +
    'const TRAINER_CLASSES = ' +
    JSON.stringify(trainers, null, 2) +
    '\n\nexport default TRAINER_CLASSES\n'
  const outPath = path.join(here, '..', 'src', 'data', 'trainerClasses.js')
  fs.writeFileSync(outPath, mod)

  console.log('Category files:', allTitles.length)
  console.log('Trainer classes kept:', trainers.length)
  console.log('→', rawPath)
  console.log('→', outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
