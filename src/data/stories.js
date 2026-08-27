// Registry of playable Stories. Each story pins a card format (era), its own
// starter decks, shop packs, and area/node progression. Adding a new story =
// author a data file like stories/kanto.js and list it here.
import { KANTO_STORY } from './stories/kanto.js'
import { ROCKET_STORY } from './stories/rocket.js'
import { LEAGUE_STORY } from './stories/league.js'
import { FORMATS } from './sets.js'

export const STORIES = {
  kanto: KANTO_STORY,
  rocket: ROCKET_STORY,
  league: LEAGUE_STORY,
}

export const storyFormat = (story) => FORMATS[story.formatId] ?? FORMATS.classic

export function findNode(story, nodeId) {
  for (const area of story.areas) {
    const i = area.nodes.findIndex((n) => n.id === nodeId)
    if (i >= 0) return { area, node: area.nodes[i], index: i }
  }
  return null
}
