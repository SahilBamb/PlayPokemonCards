// Scrapes Gym Leader tables from pokemon.fandom.com into:
//   scripts/gym_leaders_raw.json
//   src/data/gymLeaders.js
// Run: npm run scrape:gym-leaders
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'node-html-parser'

const here = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = 'https://pokemon.fandom.com/wiki/Gym_Leader'
const API =
  'https://pokemon.fandom.com/api.php?action=parse&page=Gym_Leader&prop=text&format=json&formatversion=2'
const WIKI = 'https://pokemon.fandom.com'

const REGION_HEADINGS = new Set([
  'Kanto',
  'Johto',
  'Hoenn',
  'Sinnoh',
  'Kalos',
  'Galar',
  'Paldea',
  'Orange Islands',
])

const SKIP_NAME_HREFS = /Pok%C3%A9mon_|Pokemon_|_type$|Badge|Stadium|Gym|City|Town|Island|Route_/i
const VERSION_NOTES = {
  Sw: 'Sword only',
  Sh: 'Shield only',
  B: 'Black only',
  W: 'White only',
}

function cleanHeading(el) {
  return el.text
    .replace(/\[\s*(?:edit|\s*)\s*\]/gi, '')
    .replace(/\[\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function absWikiUrl(href) {
  if (!href) return null
  if (href.startsWith('http')) return href.split('#')[0]
  if (href.startsWith('/wiki/')) return WIKI + href.split('#')[0]
  return null
}

function cleanImageUrl(url) {
  if (!url || url.startsWith('data:')) return null
  // Prefer full-size /revision/latest (drop scale-to-width-down + cache buster)
  const m = url.match(/^(https:\/\/static\.wikia\.nocookie\.net\/pokemon\/images\/[^?]+?\/revision\/latest)/)
  if (m) return m[1]
  return url.split('?')[0]
}

function imgUrlFromEl(el) {
  const img = el.querySelector('img')
  if (!img) {
    const a = el.querySelector('a[href*="static.wikia.nocookie.net"]')
    return a ? cleanImageUrl(a.getAttribute('href')) : null
  }
  return cleanImageUrl(img.getAttribute('data-src') || img.getAttribute('src'))
}

function allImgUrls(el) {
  const urls = []
  for (const img of el.querySelectorAll('img')) {
    const u = cleanImageUrl(img.getAttribute('data-src') || img.getAttribute('src'))
    if (u) urls.push(u)
  }
  if (!urls.length) {
    for (const a of el.querySelectorAll('a[href*="static.wikia.nocookie.net"]')) {
      const u = cleanImageUrl(a.getAttribute('href'))
      if (u) urls.push(u)
    }
  }
  return urls
}

function firstWikiLink(el) {
  for (const a of el.querySelectorAll('a[href*="/wiki/"]')) {
    const href = a.getAttribute('href') || ''
    const text = a.text.trim()
    if (!text || SKIP_NAME_HREFS.test(href)) continue
    // Skip tiny version markers like Sw/Sh
    if (text.length <= 2 && VERSION_NOTES[text]) continue
    return { name: text, url: absWikiUrl(href) }
  }
  const text = el.text.replace(/\s+/g, ' ').trim()
  return text ? { name: text, url: null } : null
}

function personLinks(el) {
  const people = []
  for (const a of el.querySelectorAll('a[href*="/wiki/"]')) {
    const href = a.getAttribute('href') || ''
    const text = a.text.trim()
    if (!text) continue
    if (VERSION_NOTES[text]) continue
    if (SKIP_NAME_HREFS.test(href)) continue
    // Skip game article links that aren't people
    if (/Pok%C3%A9mon_|Pokemon_/.test(href)) continue
    people.push({ name: text, url: absWikiUrl(href), anchor: a })
  }
  return people
}

function extractNotes(nameCell, personName) {
  const notes = []
  const full = nameCell.text.replace(/\s+/g, ' ').trim()

  for (const a of nameCell.querySelectorAll('a[href*="/wiki/"]')) {
    const t = a.text.trim()
    if (VERSION_NOTES[t]) notes.push(VERSION_NOTES[t])
  }

  const only = full.match(/Pokémon\s+\w+(?:\s+\w+)*\s+only/i)
  if (only) notes.push(only[0])

  if (/\(post-game\)/i.test(full) && new RegExp(`${escapeReg(personName)}\\s*\\(post-game\\)`, 'i').test(full)) {
    notes.push('post-game')
  } else if (/\(post-game\)/i.test(full) && personLinks(nameCell).length === 1) {
    notes.push('post-game')
  }

  const starter = full.match(/If the player chose \w+/i)
  if (starter) notes.push(starter[0])

  return notes.length ? [...new Set(notes)].join('; ') : null
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function nearestHeadings(table) {
  // Walk previous siblings only — first H3/H4 above the table owns it.
  // If we hit H4 first (Unova variants / Orange Islands), keep looking for H3.
  // If we hit H3 first, do not keep a stale H4 from an earlier subsection.
  let h3 = null
  let h4 = null
  let prev = table.previousElementSibling
  while (prev) {
    const tag = (prev.tagName || '').toUpperCase()
    if (tag === 'H4' && !h4 && !h3) h4 = cleanHeading(prev)
    if (tag === 'H3') {
      h3 = cleanHeading(prev)
      break
    }
    if (tag === 'H2') break
    prev = prev.previousElementSibling
  }
  return { h3, h4 }
}

function regionContext(h3, h4) {
  if (h4 && REGION_HEADINGS.has(h4)) {
    return { region: h4, variant: null }
  }
  if (h3 === 'Unova') {
    return { region: 'Unova', variant: h4 || null }
  }
  if (h3 && REGION_HEADINGS.has(h3)) {
    return { region: h3, variant: null }
  }
  return null
}

function headerKeys(headerRow) {
  return [...headerRow.querySelectorAll('th,td')].map((c) =>
    c.text.trim().toLowerCase().replace(/\s+/g, ''),
  )
}

/** Expand HTML rowspan into a full grid of cell elements (null = spanned-from-above). */
function expandTable(table) {
  const rows = [...table.querySelectorAll('tr')]
  if (!rows.length) return { headers: [], grid: [] }

  const headers = headerKeys(rows[0])
  const colCount = headers.length
  const pending = Array.from({ length: colCount }, () => null)
  const grid = []

  for (let r = 1; r < rows.length; r++) {
    const tds = [...rows[r].querySelectorAll('td')]
    const line = Array.from({ length: colCount }, () => null)
    let cellIdx = 0
    for (let col = 0; col < colCount; col++) {
      if (pending[col] && pending[col].left > 0) {
        line[col] = pending[col].el
        pending[col].left--
        if (pending[col].left === 0) pending[col] = null
        continue
      }
      const td = tds[cellIdx++]
      if (!td) continue
      line[col] = td
      const rowspan = parseInt(td.getAttribute('rowspan') || '1', 10)
      if (rowspan > 1) pending[col] = { el: td, left: rowspan - 1 }
    }
    grid.push(line)
  }
  return { headers, grid }
}

function cellBy(headers, line, key) {
  const i = headers.indexOf(key)
  return i >= 0 ? line[i] : null
}

function parseGames(gamesCell) {
  if (!gamesCell) return []
  const fromLinks = [...gamesCell.querySelectorAll('a[href*="/wiki/"]')]
    .map((a) => a.text.trim())
    .filter(Boolean)
  if (fromLinks.length) return [...new Set(fromLinks)]
  return gamesCell.text
    .split(/\n|<br\s*\/?>/i)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function parseBadge(badgeCell) {
  if (!badgeCell) return { name: null, image: null, url: null }
  const link = [...badgeCell.querySelectorAll('a[href*="/wiki/"]')].find((a) =>
    /Badge/i.test(a.getAttribute('href') || a.text),
  )
  const name =
    (link && link.text.trim()) ||
    badgeCell.text.replace(/\s+/g, ' ').trim() ||
    null
  return {
    name: name || null,
    image: imgUrlFromEl(badgeCell),
    url: link ? absWikiUrl(link.getAttribute('href')) : null,
  }
}

function leadersFromRow(headers, line, ctx) {
  const numberCell = cellBy(headers, line, 'number')
  const imageCell = cellBy(headers, line, 'image')
  const nameCell = cellBy(headers, line, 'name')
  const locationCell = cellBy(headers, line, 'location')
  const gymCell = cellBy(headers, line, 'gym')
  const typeCell = cellBy(headers, line, 'type')
  const badgeCell = cellBy(headers, line, 'badge')
  const gamesCell = cellBy(headers, line, 'games')

  if (!nameCell) return []

  const number = numberCell ? parseInt(numberCell.text.trim(), 10) || null : null
  const locationLink = locationCell ? firstWikiLink(locationCell) : null
  const gymLink = gymCell ? firstWikiLink(gymCell) : null
  const typeLink = typeCell ? firstWikiLink(typeCell) : null
  const badge = parseBadge(badgeCell)
  const games = parseGames(gamesCell)
  const images = imageCell ? allImgUrls(imageCell) : []
  const people = personLinks(nameCell)

  if (!people.length) {
    const fallback = nameCell.text.replace(/\s+/g, ' ').trim()
    if (!fallback) return []
    people.push({ name: fallback, url: null })
  }

  return people.map((person, idx) => {
    const notes = extractNotes(nameCell, person.name)
    // For multi-person cells (Opal/Bede), pair images by index; else use first image
    const image =
      people.length > 1 ? images[idx] || images[0] || null : images[0] || null
    const idBase = `${slugify(ctx.region)}${ctx.variant ? '-' + slugify(ctx.variant) : ''}-${slugify(person.name)}`
    return {
      id: idBase,
      region: ctx.region,
      variant: ctx.variant,
      number,
      name: person.name,
      nameUrl: person.url,
      image,
      location: locationLink?.name || null,
      locationUrl: locationLink?.url || null,
      gym: gymLink?.name || null,
      gymUrl: gymLink?.url || null,
      type: typeLink?.name || null,
      badge,
      games,
      notes,
    }
  })
}

function isLeaderTable(headers) {
  return headers.includes('number') && headers.includes('image') && headers.includes('name')
}

async function main() {
  const res = await fetch(API, {
    headers: { 'User-Agent': 'cardGame-scraper/1.0 (local Pokémon TCG sandbox)' },
  })
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`)
  const json = await res.json()
  const html = json.parse?.text
  if (!html) throw new Error('No parse.text in API response')

  const root = parse(html)
  const leaders = []
  const rawTables = []

  for (const table of root.querySelectorAll('table')) {
    const { h3, h4 } = nearestHeadings(table)
    const ctx = regionContext(h3, h4)
    if (!ctx) continue

    const { headers, grid } = expandTable(table)
    if (!isLeaderTable(headers)) continue

    const rows = []
    for (const line of grid) {
      const entries = leadersFromRow(headers, line, ctx)
      for (const entry of entries) {
        leaders.push(entry)
        rows.push(entry)
      }
    }
    rawTables.push({
      region: ctx.region,
      variant: ctx.variant,
      headers,
      count: rows.length,
    })
  }

  // De-dupe identical id collisions (e.g. same name in BW + B2W2) — ids already include variant
  const seen = new Set()
  const unique = []
  for (const L of leaders) {
    let id = L.id
    let n = 2
    while (seen.has(id)) {
      id = `${L.id}-${n++}`
    }
    seen.add(id)
    unique.push({ ...L, id })
  }

  const dump = {
    source: SOURCE,
    scrapedAt: new Date().toISOString(),
    tables: rawTables,
    leaders: unique,
  }

  const rawPath = path.join(here, 'gym_leaders_raw.json')
  fs.writeFileSync(rawPath, JSON.stringify(dump, null, 2) + '\n')

  const mod =
    '// Auto-generated by scripts/scrape_gym_leaders.mjs — do not edit by hand.\n' +
    'const GYM_LEADERS = ' +
    JSON.stringify(unique, null, 2) +
    '\n\nexport default GYM_LEADERS\n'
  const outPath = path.join(here, '..', 'src', 'data', 'gymLeaders.js')
  fs.writeFileSync(outPath, mod)

  const byRegion = {}
  for (const L of unique) {
    const key = L.variant ? `${L.region} (${L.variant})` : L.region
    byRegion[key] = (byRegion[key] || 0) + 1
  }
  console.log('Wrote', unique.length, 'gym leaders')
  for (const [k, v] of Object.entries(byRegion)) console.log(' ', k + ':', v)
  console.log('→', rawPath)
  console.log('→', outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
