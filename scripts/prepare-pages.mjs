import { copyFile, mkdir } from 'node:fs/promises'

// Keep direct links and refreshes working without a catch-all SPA fallback.
// These are the pathname routes recognized by src/App.jsx.
for (const route of ['card-opener', 'story-mode']) {
  await mkdir(`dist/${route}`, { recursive: true })
  await copyFile('dist/index.html', `dist/${route}/index.html`)
}
