// The Kanto story: 8 gym-town areas plus the Indigo Plateau, played with the
// Classic era (Base / Jungle / Fossil / early Promos). Each area is one
// horizontal stepper of nodes; 'mystery' nodes render as ? and 'boss' nodes
// as ! until challenged.
import GYM_LEADERS from '../gymLeaders.js'
import TRAINER_CLASSES from '../trainerClasses.js'
import { ELITE_FOUR } from '../eliteFour.js'

const leader = (id) => GYM_LEADERS.find((l) => l.id === id)
const tclassImg = (id) => TRAINER_CLASSES.find((t) => t.id === id)?.image ?? null
const e4 = (id) => ELITE_FOUR.find((e) => e.id === id)

const RIVAL = { name: 'Rival Blue', image: leader('kanto-blue')?.image }

// Regular trainer node. Deck is generated deterministically from the node id.
const trainer = (id, classId, name, { types, tier, aiId = 'aggro', intro, win, lose }) => ({
  id,
  kind: 'trainer',
  char: { name, image: tclassImg(classId) },
  aiId,
  deck: { gen: { types, tier } },
  rewards: { win: 40 + tier * 20, lose: 15 },
  dialogue: {
    intro: intro ?? [`${name} wants to battle!`],
    win: win ?? ['Aw, I lost! You battled really well.'],
    lose: lose ?? ['Heh, better luck next time!'],
  },
})

const rival = (id, deckKey, intro, win, lose) => ({
  id,
  kind: 'mystery',
  char: RIVAL,
  aiId: 'basic',
  deck: { boss: deckKey },
  rewards: { win: 120, lose: 25 },
  dialogue: {
    intro,
    win: win ?? ['WHAT? Unbelievable! I picked the wrong cards!', 'Smell ya later!'],
    lose: lose ?? ['Yes! Am I great or what?', 'Go buy some real cards. Smell ya later!'],
  },
})

const boss = (id, who, deckKey, { aiId = 'basic', rewards = { win: 200, lose: 40 }, intro, win, lose }) => ({
  id,
  kind: 'boss',
  char: { name: who.name, image: who.image },
  aiId,
  deck: { boss: deckKey },
  rewards,
  dialogue: { intro, win, lose },
})

const eliteNode = (id, who, deckKey, intro, win) => ({
  id,
  kind: 'trainer',
  char: { name: who.name, image: who.image },
  aiId: 'basic',
  deck: { boss: deckKey },
  rewards: { win: 150, lose: 30 },
  dialogue: {
    intro,
    win: win ?? ['...You are stronger than I thought. Go on.'],
    lose: ['The Elite Four is not to be taken lightly. Come back stronger.'],
  },
})

export const KANTO_STORY = {
  id: 'kanto',
  name: 'Kanto',
  description: 'The original journey: eight Gym Leaders, the Elite Four, and a familiar rival. Classic era cards.',
  formatId: 'classic',
  packs: ['base1', 'jungle', 'fossil'],
  promoEvent: { packId: 'promoPack', chance: 0.12 },
  subPackEvent: { chance: 0.35 },
  startingCoins: 250,
  badgeBonus: 100,
  cover: leader('kanto-brock')?.badge?.image,
  trophy: {
    name: 'Kanto Champion Trophy',
    // the game log / badge case renders this emoji-style if no image
    image: null,
  },
  starterDecks: [
    {
      id: 'kanto-water',
      name: 'Tidal Wave',
      description: 'Squirtle, Staryu, and friends. Steady damage and a little healing.',
      coverCards: ['Squirtle', 'Staryu'],
      counts: {
        Squirtle: 4, Wartortle: 2, Staryu: 4, Starmie: 2, Goldeen: 4, Seaking: 2, Poliwag: 2, Pidgey: 3,
        Bill: 2, Potion: 2, Switch: 2, 'Energy Search': 2,
        'Water Energy': 29,
      },
    },
    {
      id: 'kanto-fire',
      name: 'Blazing Fists',
      description: 'Charmander and Ponyta backed by Fighting muscle.',
      coverCards: ['Charmander', 'Ponyta'],
      counts: {
        Charmander: 4, Charmeleon: 2, Vulpix: 4, Growlithe: 3, Ponyta: 4, Rapidash: 2, Machop: 3, Mankey: 2,
        Bill: 2, Potion: 2, Switch: 2, 'Energy Search': 2,
        'Fire Energy': 16, 'Fighting Energy': 12,
      },
    },
    {
      id: 'kanto-grass',
      name: 'Overgrowth',
      description: 'Bulbasaur, Oddish, and Bellsprout — poison and drain your way to victory.',
      coverCards: ['Bulbasaur', 'Oddish'],
      counts: {
        Bulbasaur: 4, Ivysaur: 2, Oddish: 4, Gloom: 2, Bellsprout: 4, Weepinbell: 2, 'Nidoran ♂': 3,
        Bill: 2, Potion: 2, Switch: 2, 'Energy Search': 2,
        'Grass Energy': 31,
      },
    },
  ],
  areas: [
    {
      id: 'pewter',
      name: 'Pewter City',
      badge: leader('kanto-brock').badge,
      nodes: [
        trainer('pewter-1', 'oras-youngster', 'Youngster Joey', {
          types: ['colorless'], tier: 1, aiId: 'random',
          intro: ['Hi! I like shorts!', "They're comfy and easy to wear! Let's battle!"],
        }),
        trainer('pewter-2', 'oras-bug-catcher', 'Bug Catcher Rick', {
          types: ['grass'], tier: 1, aiId: 'random',
          intro: ['My bug Pokémon cards are the best!', 'Prepare to get stung!'],
        }),
        rival('pewter-3', 'rival1', [
          'Hey! Wait up!', "It's me, Blue! I got my own cards now.", "Let's see whose deck is better. Mine, obviously!",
        ]),
        boss('pewter-boss', leader('kanto-brock'), 'brock', {
          rewards: { win: 180, lose: 35 },
          intro: ["I'm Brock, Pewter's Gym Leader.", 'My rock-hard Pokémon will show you true grit!'],
          win: ['I took you for granted...', 'Take the Boulder Badge. You earned it.'],
          lose: ['A defense that solid takes more than spirit to crack. Train and return!'],
        }),
      ],
    },
    {
      id: 'cerulean',
      name: 'Cerulean City',
      badge: leader('kanto-misty').badge,
      nodes: [
        trainer('cerulean-1', 'oras-lass', 'Lass Dana', {
          types: ['colorless'], tier: 1,
          intro: ["You looked at me, didn't you? That means we battle!"],
        }),
        trainer('cerulean-2', 'oras-picnicker', 'Picnicker Kelsey', {
          types: ['grass', 'colorless'], tier: 1, aiId: 'random',
          intro: ['I was just setting up my picnic...', 'But a battle sounds way more fun!'],
        }),
        trainer('cerulean-3', 'oras-swimmer-f', 'Swimmer Diana', {
          types: ['water'], tier: 1,
          intro: ['The water is great here!', 'My Water Pokémon are itching for a battle.'],
        }),
        boss('cerulean-boss', leader('kanto-misty'), 'misty', {
          rewards: { win: 180, lose: 35 },
          intro: ["I'm Misty, the world-famous beauty... and Cerulean's Gym Leader!", 'My Water Pokémon will wash you away!'],
          win: ["Wow, you're too much!", 'All right — the Cascade Badge is yours.'],
          lose: ["That's what happens when you swim out of your depth!"],
        }),
      ],
    },
    {
      id: 'vermilion',
      name: 'Vermilion City',
      badge: leader('kanto-lt-surge').badge,
      nodes: [
        trainer('vermilion-1', 'oras-sailor', 'Sailor Dwayne', {
          types: ['water'], tier: 2,
          intro: ['Ahoy! Back from a long voyage.', 'A battle before shore leave? Aye!'],
        }),
        trainer('vermilion-2', 'oras-fisherman', 'Fisherman Wade', {
          types: ['water'], tier: 2, aiId: 'stall',
          intro: ['Patience is the key to fishing... and to battling.', 'Let me show you.'],
        }),
        rival('vermilion-3', 'rival2', [
          "Bonjour! Hahaha, it's just me, Blue!", 'My deck got a serious upgrade since Pewter.', 'Try to keep up this time!',
        ]),
        boss('vermilion-boss', leader('kanto-lt-surge'), 'surge', {
          rewards: { win: 200, lose: 40 },
          intro: ["Hey, kid! I'm Lt. Surge, the Lightning American!", 'My Electric Pokémon will shock you into surrender!'],
          win: ["WHOA! You're the real deal, kid!", 'Take the Thunder Badge!'],
          lose: ["HA! You're a million years too early to beat me!"],
        }),
      ],
    },
    {
      id: 'celadon',
      name: 'Celadon City',
      badge: leader('kanto-erika').badge,
      nodes: [
        trainer('celadon-1', 'oras-aroma-lady', 'Aroma Lady Nikki', {
          types: ['grass'], tier: 2, aiId: 'stall',
          intro: ['Do you smell that? Lovely fragrances bloom in Celadon.', 'My Grass Pokémon and I will lull you to sleep.'],
        }),
        trainer('celadon-2', 'oras-beauty', 'Beauty Grace', {
          types: ['colorless', 'water'], tier: 2,
          intro: ['A battle? Fine — but make it quick, I have a photoshoot.'],
        }),
        trainer('celadon-3', 'oras-rich-boy', 'Rich Boy Winston', {
          types: ['colorless'], tier: 2, aiId: 'random',
          intro: ['My cards cost more than your whole collection!', 'Money talks... battle!'],
        }),
        boss('celadon-boss', leader('kanto-erika'), 'erika', {
          rewards: { win: 200, lose: 40 },
          intro: ['Welcome to Celadon Gym. I am Erika.', 'I teach flower arranging... and my Pokémon teach patience.'],
          win: ['Oh... how lovely a battle.', 'Please accept the Rainbow Badge.'],
          lose: ['Perhaps you should stop and smell the flowers before trying again.'],
        }),
      ],
    },
    {
      id: 'fuchsia',
      name: 'Fuchsia City',
      badge: leader('kanto-koga').badge,
      nodes: [
        trainer('fuchsia-1', 'oras-ninja-boy', 'Ninja Boy Hideo', {
          types: ['grass'], tier: 2,
          intro: ['You never saw me coming!', 'Ninja arts and poison — a deadly pair!'],
        }),
        trainer('fuchsia-2', 'oras-bug-maniac', 'Bug Maniac Aidan', {
          types: ['grass'], tier: 2,
          intro: ['Bugs! Bugs! BUGS!', 'My collection will crawl all over you!'],
        }),
        trainer('fuchsia-3', 'oras-collector', 'Collector Douglas', {
          types: ['fighting', 'water'], tier: 2, aiId: 'stall',
          intro: ['I dug these fossils myself!', 'Ancient Pokémon, show your power!'],
        }),
        boss('fuchsia-boss', leader('kanto-koga'), 'koga', {
          rewards: { win: 220, lose: 40 },
          intro: ['Fwahaha! I am Koga, master of ninjutsu!', 'Poison will seep through your defenses!'],
          win: ['You have proven your worth...', 'The Soul Badge is yours, young warrior.'],
          lose: ['Fwahaha! Dissolve into the shadows and reflect on your defeat!'],
        }),
      ],
    },
    {
      id: 'saffron',
      name: 'Saffron City',
      badge: leader('kanto-sabrina').badge,
      nodes: [
        trainer('saffron-1', 'oras-schoolkid-m', 'Schoolkid Jem', {
          types: ['psychic'], tier: 2, aiId: 'stall',
          intro: ['I studied every card in the library!', 'Time for a pop quiz!'],
        }),
        trainer('saffron-2', 'oras-poke-maniac', 'Poké Maniac Cash', {
          types: ['psychic', 'colorless'], tier: 2,
          intro: ['Hehehe... my rare cards are my treasures.', 'Behold their power!'],
        }),
        rival('saffron-3', 'rival3', [
          'Yo! I was about to challenge the Gym.', "But beating you sounds more fun. It's rival time!",
        ]),
        boss('saffron-boss', leader('kanto-sabrina'), 'sabrina', {
          rewards: { win: 220, lose: 45 },
          intro: ['I knew you were coming...', 'I am Sabrina. My psychic power will bend your cards to my will.'],
          win: ['I foresaw this defeat... yet it still stings.', 'The Marsh Badge is yours.'],
          lose: ['I saw this outcome three turns ago. Return when fate favors you.'],
        }),
      ],
    },
    {
      id: 'cinnabar',
      name: 'Cinnabar Island',
      badge: leader('kanto-blaine').badge,
      nodes: [
        trainer('cinnabar-1', 'oras-kindler', 'Kindler Bernie', {
          types: ['fire'], tier: 2,
          intro: ['Fire is life! Fire is passion!', 'BURN with me!'],
        }),
        trainer('cinnabar-2', 'oras-scuba-diver', 'Scuba Diver Silas', {
          types: ['water'], tier: 3, aiId: 'stall',
          intro: ['I explore the seafloor around the island.', 'The pressure down there? Nothing next to my deck!'],
        }),
        trainer('cinnabar-3', 'oras-expert-m', 'Expert Timeo', {
          types: ['fighting'], tier: 3,
          intro: ['Decades of training led me here.', 'Show me your technique!'],
        }),
        boss('cinnabar-boss', leader('kanto-blaine'), 'blaine', {
          rewards: { win: 240, lose: 45 },
          intro: ['Hah! I am Blaine, the red-hot quiz master!', 'Question: are you about to lose? Answer: YES!'],
          win: ['I have burned out...', 'Take the Volcano Badge before it melts!'],
          lose: ['Wrong answer! Study harder and come back!'],
        }),
      ],
    },
    {
      id: 'viridian',
      name: 'Viridian City',
      badge: leader('kanto-giovanni').badge,
      nodes: [
        trainer('viridian-1', 'oras-street-thug', 'Thug Marco', {
          types: ['grass'], tier: 3,
          intro: ["This gym's under new management, see?", 'Beat it, or get beat!'],
        }),
        trainer('viridian-2', 'oras-delinquent', 'Delinquent Roxie', {
          types: ['psychic'], tier: 3,
          intro: ["You're in the wrong part of town.", "I'll take those badges off you!"],
        }),
        trainer('viridian-3', 'oras-gentleman', 'Gentleman Arthur', {
          types: ['colorless'], tier: 3, aiId: 'stall',
          intro: ['A duel, then. I insist on proper etiquette...', 'And total victory.'],
        }),
        boss('viridian-boss', leader('kanto-giovanni'), 'giovanni', {
          rewards: { win: 260, lose: 50 },
          intro: ['So you have come this far...', 'I am Giovanni. The Earth itself answers to me!'],
          win: ['Ha! This cannot be!', 'Take the Earth Badge. You have bested the strongest Gym Leader.'],
          lose: ['You are years away from challenging me. Leave my sight.'],
        }),
      ],
    },
    {
      id: 'indigo',
      name: 'Indigo Plateau',
      badge: null, // completing this area awards the trophy instead
      nodes: [
        eliteNode('indigo-1', e4('kanto-lorelei'), 'lorelei', [
          'Welcome to the Pokémon League. I am Lorelei of the Elite Four.', 'My icy Water Pokémon will freeze you solid!',
        ]),
        eliteNode('indigo-2', e4('kanto-bruno'), 'bruno', [
          'I am Bruno! We will grind you down with sheer power!', 'Hoo hah!',
        ]),
        eliteNode('indigo-3', e4('kanto-agatha'), 'agatha', [
          'I am Agatha, the eldest of the Elite Four.', 'My ghosts will haunt your every draw!',
        ]),
        eliteNode('indigo-4', e4('kanto-lance'), 'lance', [
          'Ah, I heard about you. I am Lance, the dragon master.', 'There is no room for weakness here!',
        ]),
        boss('indigo-boss', { name: 'Champion Blue', image: leader('kanto-blue')?.image }, 'champion', {
          rewards: { win: 500, lose: 60 },
          intro: [
            'Hey! I was looking forward to seeing you!', "That's right — I'm the Champion!",
            "I'm the most powerful trainer in the world! Let's settle this, once and for all!",
          ],
          win: ["NO! That can't be!", '...You really are the best trainer now.', 'Congratulations, Champion.'],
          lose: ['Hahaha! Champion Blue reigns supreme!', 'Smell ya later!'],
        }),
      ],
    },
  ],
}
