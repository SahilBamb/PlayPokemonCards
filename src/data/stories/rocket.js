// The Rocket Takeover story: Team Rocket rules Kanto and a rebellion is
// fighting back. Sabrina — power-hungry and calling herself Champion — has
// mind-controlled several Gym Leaders into serving as Rocket bosses, while a
// few unexpected allies ("Anti-Team Rocket" fighters) train the player early
// on. Played in the rocketClassic era (Classic sets + Team Rocket).
import GYM_LEADERS from '../gymLeaders.js'

const leaderBadge = (id) => GYM_LEADERS.find((l) => l.id === id)?.badge ?? null
const img = (file) => `/trainers/TeamRocket/${file}.png`
const say = (who, text) => ({ name: who.name, image: who.image ?? null, text })
const CLAIR = { name: 'Rebel Leader Clair', image: img('Anti-Team Rocket Claire') }
const SURGE = { name: 'Rebel Lt. Surge', image: img('Anti-Team Rocket Lt. Surge') }
const WANDA = { name: 'Deserter Wanda', image: img('Team Rocket Grunt Shopper') }
const GRUNT = { name: 'Lost Rocket Grunt', image: img('Team Rocket Grunt Purple') }
const MISTY = { name: 'Misty', image: img('Team Rocket Executive Misty') }
const ERIKA = { name: 'Erika', image: img('Team Rocket Boss Erika') }
const BLAINE = { name: 'Blaine', image: img('Team Rocket Blaine') }
const NORMAN = { name: 'Norman', image: img('Team Rocket Boss Norman') }
const SABRINA = { name: 'Sabrina', image: img('Team Rocket Champion Sabrina') }
const GIOVANNI = { name: 'Giovanni', image: img('Anti-Team Rocket Giovanni') }

// Regular trainer node with a generated deck (same shape as kanto.js).
const trainer = (id, image, name, { types, tier, aiId = 'aggro', intro, win, lose }) => ({
  id,
  kind: 'trainer',
  char: { name, image },
  aiId,
  deck: { gen: { types, tier } },
  rewards: { win: 40 + tier * 20, lose: 15 },
  dialogue: {
    intro: intro ?? [`${name} wants to battle!`],
    win: win ?? ['Ugh... reporting a defeat to HQ is the worst.'],
    lose: lose ?? ['Team Rocket always wins!'],
  },
})

// Named opponent with a hand-authored deck (rebels, executives, mid-bosses).
const named = (id, kind, name, image, deckKey, { aiId = 'basic', rewards = { win: 150, lose: 30 }, intro, win, lose }) => ({
  id,
  kind,
  char: { name, image },
  aiId,
  deck: { boss: deckKey },
  rewards,
  dialogue: {
    intro,
    win: win ?? ['...You win this one.'],
    lose: lose ?? ['Come back when you are stronger.'],
  },
})

export const ROCKET_STORY = {
  id: 'rocket',
  name: 'Rocket Takeover',
  description:
    'Team Rocket rules Kanto and Sabrina sits on the Champion throne. Join the rebellion, free the mind-controlled Gym Leaders, and take the region back. Adds Team Rocket cards.',
  formatId: 'rocketClassic',
  packs: ['base1', 'jungle', 'fossil', 'rocket'],
  promoEvent: { packId: 'promoPack', chance: 0.12 },
  subPackEvent: { chance: 0.35 },
  startingCoins: 250,
  badgeBonus: 100,
  cover: img('Team Rocket Master'),
  shopkeeper: {
    name: 'Deserter Wanda',
    image: img('Team Rocket Grunt Shopper'),
    greeting:
      "Psst... I quit Team Rocket, but I kept the keys to their supply trucks. Boosters, dark Pokémon, the works — the rebellion shops here. Just don't tell HQ where you got them, alright?",
  },
  trophy: {
    name: 'Liberation Trophy',
    image: null,
  },
  starterDecks: [
    {
      id: 'rocket-volt',
      name: 'Static Cell',
      description: 'A scrappy rebel cell of Pikachu and stolen Rocket Voltorb. Fast, loud, expendable.',
      coverCards: ['Pikachu', 'Voltorb (Rocket)'],
      counts: {
        Pikachu: 4, 'Voltorb (Rocket)': 4, 'Dark Electrode': 2, 'Magnemite (Rocket)': 4,
        'Meowth (Rocket)': 3, 'Eevee (Rocket)': 3, 'Rattata (Rocket)': 2,
        Bill: 2, Potion: 2, Switch: 2, 'Energy Search': 2,
        'Lightning Energy': 30,
      },
    },
    {
      id: 'rocket-sludge',
      name: 'Toxic Uprising',
      description: 'Poison and sludge liberated from a Rocket lab. Wear them down turn by turn.',
      coverCards: ['Ekans (Rocket)', 'Oddish (Rocket)'],
      counts: {
        'Ekans (Rocket)': 4, 'Zubat (Rocket)': 4, 'Dark Golbat': 2, 'Oddish (Rocket)': 4,
        'Dark Gloom': 2, 'Grimer (Rocket)': 3, 'Drowzee (Rocket)': 3,
        Bill: 2, Potion: 2, Switch: 2, 'Energy Search': 2,
        'Grass Energy': 22, 'Psychic Energy': 8,
      },
    },
    {
      id: 'rocket-ember',
      name: 'Ember Underground',
      description: 'Charmander and Ponyta smuggled out of Cinnabar, with fists for backup.',
      coverCards: ['Charmander (Rocket)', 'Ponyta (Rocket)'],
      counts: {
        'Charmander (Rocket)': 4, 'Dark Charmeleon': 2, 'Ponyta (Rocket)': 4, 'Dark Rapidash': 2,
        Growlithe: 3, 'Machop (Rocket)': 4, 'Mankey (Rocket)': 3,
        Bill: 2, Potion: 2, Switch: 2, 'Energy Search': 2,
        'Fire Energy': 18, 'Fighting Energy': 12,
      },
    },
  ],
  intro: [
    say(CLAIR, 'So. The new recruit. I am Clair — I came from Johto because Kanto fell, and dragons do not kneel.'),
    say(SURGE, 'Lt. Surge. Ex-gym, full-time Rocket wrecker. We train you or we bury you. Prefer option one.'),
    say(GRUNT, 'HEY! This hideout is— wait. This is the WRONG warehouse—'),
    say(SURGE, 'ZAP! And stay down, rat!'),
    say(CLAIR, "They are everywhere. Sabrina sits on the Champion throne, and several Gym Leaders wear her voice."),
    say(WANDA, "Psst. I'm Wanda. I quit Rocket and kept the truck keys. Shop's in the back — boosters, dark cards, don't tell HQ."),
    say(CLAIR, 'Take {starter}. Survive our exams. Then we send you into the field.'),
    say(SURGE, 'Cerulean Harbor first, if you graduate. Move, soldier!'),
  ],
  areas: [
    {
      id: 'hideout',
      name: 'Rebel Hideout',
      badge: leaderBadge('johto-clair'),
      cutscene: [
        say(CLAIR, 'Exam passed. The Rising Badge is yours — Kanto rises with you.'),
        say(SURGE, "Harbor next. Misty's theirs now. Don't hesitate when her eyes go blank."),
        say(WANDA, "I packed you a discount. Don't waste it dying."),
        say(CLAIR, 'Free her if you can. The rebellion needs its Leaders back.'),
      ],
      nodes: [
        trainer('hideout-1', img('Anti-Team Rocket Koga Son'), 'Rebel Kenji', {
          types: ['grass'], tier: 1, aiId: 'random',
          intro: [
            'Welcome to the hideout. I am Kenji — my father Koga went missing when Rocket took Fuchsia.',
            "Before you fight Team Rocket, you fight us. That's the rule. Training match, go!",
          ],
          win: ['Good. You strike like a ninja already.', 'Save that edge for the grunts outside.'],
          lose: ['Too slow! Team Rocket would have you in a cage by now. Again!'],
        }),
        trainer('hideout-2', img('Anti-Team Rocket Janine'), 'Rebel Janine', {
          types: ['grass', 'psychic'], tier: 1,
          intro: [
            'I am Janine. Kenji says you have promise — I will be the judge of that.',
            'Poison spreads slowly, like a rebellion. Show me you can outlast it!',
          ],
          win: ['You endured every toxin I had. Impressive.', 'The harbor grunts will be easier than me.'],
          lose: ['Antidotes are in the back room. Rest up and try me again.'],
        }),
        named('hideout-3', 'mystery', 'Rebel Lt. Surge', img('Anti-Team Rocket Lt. Surge'), 'rebelSurge', {
          aiId: 'aggro',
          rewards: { win: 120, lose: 25 },
          intro: [
            "Surprise, kid! Lt. Surge, ex-Vermilion Gym, full-time Rocket wrecker.",
            'Rocket took my gym, so now I train rebels. Survive my voltage and you graduate!',
          ],
          win: ['HAH! You lit up like a Christmas tree and kept coming. I like it!', "You're ready for Clair's exam."],
          lose: ['ZAP! Fried! Shake it off, soldier, and get back in there!'],
        }),
        named('hideout-boss', 'boss', 'Rebel Leader Clair', img('Anti-Team Rocket Claire'), 'rebelClair', {
          rewards: { win: 160, lose: 30 },
          intro: [
            'I am Clair. I came from Johto when I heard Kanto had fallen — dragons do not kneel to rats.',
            'This is your final exam. Beat me, and the rebellion sends you into the field.',
          ],
          win: [
            'Magnificent. My dragons approve, and they approve of no one.',
            'Take the Rising Badge — a symbol that Kanto rises with you. Now go. Cerulean Harbor first.',
          ],
          lose: ['Not yet. A dragon can smell hesitation. Train and face me again.'],
        }),
      ],
    },
    {
      id: 'harbor',
      name: 'Cerulean Harbor',
      badge: leaderBadge('kanto-misty'),
      cutscene: [
        say(MISTY, 'The water... my gym... I remember you dragging me out.'),
        say(CLAIR, 'Welcome back, Executive — no. Gym Leader.'),
        say(MISTY, 'Sabrina was in my head. The Game Corner is next. Something rotten runs under Celadon.'),
        say(WANDA, "I'll move the shop closer to the docks. You look like you need more packs."),
      ],
      nodes: [
        trainer('harbor-1', img('Team Rocket Sailor Grunt'), 'Rocket Sailor Dorian', {
          types: ['water'], tier: 1,
          intro: ["Oi! This dock is Team Rocket property!", 'Every crate here ships to HQ — including you, once I win!'],
          win: ['My cargo! My reputation! The Executive will keelhaul me...'],
          lose: ['Overboard you go! Team Rocket owns the seas!'],
        }),
        named('harbor-2', 'mystery', 'Upstart Zinnia', img('Team Rocket Upstart Zinnia'), 'zinnia', {
          aiId: 'aggro',
          rewards: { win: 120, lose: 25 },
          intro: [
            'Well, well. A rebel sneaking along the docks.',
            "I'm Zinnia. I joined Team Rocket for the dragons... mostly for the dragons.",
            'Beat me and maybe I rethink my career. Lorekeeper rules — no holding back!',
          ],
          win: [
            'Ha! You fight like the old tales say heroes do.',
            "Rocket's dragons deserve better than cages. Consider me... retired. The Executive is in the lighthouse.",
          ],
          lose: ['The sky calls, little rebel, and you are not ready for it.'],
        }),
        named('harbor-boss', 'boss', 'Executive Misty', img('Team Rocket Executive Misty'), 'execMisty', {
          rewards: { win: 180, lose: 35 },
          intro: [
            '...Do I know you? My head aches when I try to remember.',
            'I am Executive Misty of Team Rocket. Sabrina says the harbor is mine to hold.',
            'The tide takes everything. It will take you too!',
          ],
          win: [
            'The water... my gym... what have I been DOING?',
            "Sabrina was in my head. Thank you for dragging me out.",
            'Take the Cascade Badge — and watch the Game Corner. Something rotten runs under Celadon.',
          ],
          lose: ['Wash away, little rebel. The harbor belongs to Team Rocket.'],
        }),
      ],
    },
    {
      id: 'corner',
      name: 'Celadon Game Corner',
      badge: leaderBadge('kanto-erika'),
      cutscene: [
        say(ERIKA, 'The perfume fades. What a horrid dream I was living.'),
        say(CLAIR, 'Flowers and a rebellion. Unexpected allies.'),
        say(ERIKA, 'They took Cinnabar Lab next. Poor Blaine — he burns for them now.'),
        say(SURGE, 'Then we cut the power. Lab first, feelings later.'),
      ],
      nodes: [
        trainer('corner-1', img('Team Rocket Grunt Rich Boy'), 'Rocket Financier Silas', {
          types: ['colorless'], tier: 2, aiId: 'random',
          intro: ['I bankroll this whole operation, you know.', 'Every coin in this Game Corner is mine. Care to lose some cards too?'],
          win: ['My portfolio! My rare candies! Daddy will hear about this!'],
          lose: ['The house always wins — and I AM the house.'],
        }),
        trainer('corner-2', img('Team Rocket Purple Poke Fan'), 'Rocket Poké Fan Lila', {
          types: ['psychic', 'colorless'], tier: 2,
          intro: ["Aren't Team Rocket's Pokémon just DARLING?", 'The dark ones are my favorites. Let me show you my collection!'],
          win: ['My darlings lost?! They tried their best, they really did!'],
          lose: ['See? Dark Pokémon are simply better dressed.'],
        }),
        trainer('corner-3', img('Team Rocket Grunt Poke Maniac'), 'Rocket Maniac Grif', {
          types: ['fighting'], tier: 2,
          intro: ['Hehehe... the basement is FULL of rare Pokémon, all confiscated.', 'You want them back? Come take them!'],
          win: ['Fine, FINE! The cage keys are behind the counter, just stop hitting me!'],
          lose: ['Into the basement with the rest of them!'],
        }),
        named('corner-boss', 'boss', 'Boss Erika', img('Team Rocket Boss Erika'), 'bossErika', {
          aiId: 'stall',
          rewards: { win: 200, lose: 40 },
          intro: [
            'Welcome to my parlor. I am Erika... Boss Erika, of Team Rocket.',
            'Sabrina showed me such beautiful dreams. Kanto asleep, forever, under my flowers.',
            'Breathe deep. The pollen is already working.',
          ],
          win: [
            '...The perfume fades. What a horrid dream I was living.',
            'You have my gratitude, and the Rainbow Badge.',
            'They took Cinnabar Lab next. Poor Blaine — he burns for them now.',
          ],
          lose: ['Shhh. Sleep now. The rebellion was only ever a dream.'],
        }),
      ],
    },
    {
      id: 'lab',
      name: 'Cinnabar Lab',
      badge: leaderBadge('kanto-blaine'),
      cutscene: [
        say(BLAINE, 'Correct answer! My head is my own again!'),
        say(GIOVANNI, 'Magnificent. Sabrina stole what I built. Burn the rest.'),
        say(BLAINE, 'Silph Co. is their fortress. The Manager and their "Boss" Norman hold it.'),
        say(CLAIR, 'Careful of Giovanni\'s "help." Dragons trust few rats.'),
      ],
      nodes: [
        trainer('lab-1', img('Team Rocket Grunt Mechanic'), 'Rocket Mechanic Bolt', {
          types: ['lightning'], tier: 2,
          intro: ['The generators are MINE. The lab is MINE.', 'Touch my wiring and get fried!'],
          win: ['Short circuit! Systems down! Abandoning workstation!'],
          lose: ['ZZZAP! Another rebel fuse blown!'],
        }),
        trainer('lab-2', img('Team Rocket Grunt Maniac'), 'Rocket Maniac Vex', {
          types: ['psychic'], tier: 2, aiId: 'stall',
          intro: ["Hee hee hee... Sabrina's experiments live in these tanks.", 'Want to see what they do to a mind like yours?'],
          win: ['The tanks! The specimens! The paperwork I will have to file!'],
          lose: ['Your mind is mush. Just like the Champion promised.'],
        }),
        named('lab-3', 'mystery', 'Giovanni', img('Anti-Team Rocket Giovanni'), 'rebelGiovanni', {
          rewards: { win: 150, lose: 30 },
          intro: [
            'So the rebellion sends a child into my old organization.',
            'Yes. I am Giovanni. I BUILT Team Rocket — and Sabrina stole it from me while I trained alone.',
            'The enemy of my enemy... needs testing. Show me the Earth-shaking strength it takes to topple her!',
          ],
          win: [
            'Ha! HAHAHA! Magnificent.',
            'You may just be strong enough to reach her throne. My old passcodes will open Silph Co.',
            'Destroy what I built. I would rather see it burn than see her wear my crown.',
          ],
          lose: ['Pathetic. Sabrina would grind you to dust. Return when you are worth my time.'],
        }),
        named('lab-boss', 'boss', 'Rocket Blaine', img('Team Rocket Blaine'), 'rocketBlaine', {
          aiId: 'aggro',
          rewards: { win: 220, lose: 40 },
          intro: [
            'Quiz time! Who works for Team Rocket now? Answer: I DO!',
            'Sabrina lit a fire in my mind and I have no desire to put it out!',
            'Final question: can you stand the heat?!',
          ],
          win: [
            'The fire... dims. My head is my own again. Correct answer, kid!',
            'Take the Volcano Badge! Silph Co. is their fortress — the Manager and their "Boss" Norman hold it.',
          ],
          lose: ['WRONG! You burn like all the rest! HAHAHA!'],
        }),
      ],
    },
    {
      id: 'silph',
      name: 'Silph Co.',
      badge: leaderBadge('hoenn-norman'),
      cutscene: [
        say(NORMAN, 'My family... I was supposed to go home months ago.'),
        say(CLAIR, 'Then go. We will finish this.'),
        say(NORMAN, 'She waits at the old Rocket HQ in Viridian, with the last of her enforcers.'),
        say(SURGE, 'Finally. The front door. I have been waiting to kick it in.'),
      ],
      nodes: [
        trainer('silph-1', img('Team Rocket Pyschic Grunt'), 'Rocket Psychic Ansel', {
          types: ['psychic'], tier: 3, aiId: 'stall',
          intro: ['The Champion sees through my eyes.', 'She already knows how this battle ends. Shall we perform it anyway?'],
          win: ['She... she saw this? Then why did she let me lose?!'],
          lose: ['Exactly as foreseen. Every move of yours, scripted.'],
        }),
        trainer('silph-2', img('Team Rocket Grunt Purple'), 'Rocket Grunt Vera', {
          types: ['grass', 'psychic'], tier: 3,
          intro: ['Nobody gets past the lobby. Boss Norman is very clear about visitors.', 'Nothing personal, rebel.'],
          win: ['Elevator is behind me... I saw nothing, I know nothing.'],
          lose: ['And stay out of the tower!'],
        }),
        named('silph-3', 'trainer', 'The Manager', img('Team Rocket Manager'), 'rocketManager', {
          rewards: { win: 160, lose: 30 },
          intro: [
            'I manage logistics, personnel, and intruders. You fall under column three.',
            'Sabrina automated the Gym Leaders, but middle management? We chose this. The benefits are excellent.',
          ],
          win: ['This is a disaster for my quarterly review.', 'Fine — Norman is upstairs. Tell him I fought valiantly.'],
          lose: ['Efficient, clean, by the book. Security will show you out.'],
        }),
        named('silph-boss', 'boss', 'Boss Norman', img('Team Rocket Boss Norman'), 'bossNorman', {
          rewards: { win: 240, lose: 45 },
          intro: [
            'I am Norman. I came to Kanto to visit an old friend... and Sabrina gave me a new purpose instead.',
            'Balance in all things — including a rebellion crushed with a perfectly even hand.',
          ],
          win: [
            '...My family. I was supposed to go home months ago.',
            'That woman took my mind. Take her badge stockpile — this Balance Badge — and take her DOWN.',
            'She waits at the old Rocket HQ in Viridian, with the last of her enforcers.',
          ],
          lose: ['Steady. Measured. Inevitable. That is Team Rocket under my watch.'],
        }),
      ],
    },
    {
      id: 'hq',
      name: 'Viridian Rocket HQ',
      badge: null, // clearing HQ awards the Liberation Trophy
      cutscene: [
        say(SABRINA, 'I... I can hear my own thoughts again.'),
        say(CLAIR, 'Stay down, Champion. The throne is empty.'),
        say(SABRINA, 'Someone taught me this hunger. A voice from Viridian...'),
        say(GIOVANNI, 'A fine performance. Both of you.'),
        say(CLAIR, 'Giovanni?'),
        say(GIOVANNI, 'The region is "free." For now. Do enjoy it.'),
        say(WANDA, "Shop's staying open. Liberated Kanto still needs cards — and I still have the keys."),
      ],
      nodes: [
        named('hq-1', 'trainer', 'The Rocket Master', img('Team Rocket Master'), 'rocketMaster', {
          rewards: { win: 180, lose: 35 },
          intro: [
            'I trained every grunt, every executive, every enforcer in this building.',
            'Sabrina keeps me around because I never lose. Care to audit that record?',
          ],
          win: ['...Record: amended.', 'The old Champion is on the top floor. She has been waiting for you specifically.'],
          lose: ['Add another win to the ledger. Class dismissed.'],
        }),
        named('hq-2', 'trainer', 'Old Lance', img('Team Rocket Boss Old Lance'), 'oldLance', {
          rewards: { win: 200, lose: 40 },
          intro: [
            'I was Champion once, long before this darkness. Now my dragons wear their chains willingly... as do I.',
            'Sabrina promised me an era of dragons. All it cost was everyone else.',
            'Forgive me, child. The old Lance would have fought beside you.',
          ],
          win: [
            'The chains... break. Both mine and theirs.',
            'There is still a Champion in this tower, and it is not me. End this. For Kanto.',
          ],
          lose: ['Even corrupted, a dragon master does not fall to half measures.'],
        }),
        named('hq-boss', 'boss', 'Champion Sabrina', img('Team Rocket Champion Sabrina'), 'champSabrina', {
          rewards: { win: 500, lose: 60 },
          intro: [
            'I felt you climbing my tower floor by floor, undoing years of careful work.',
            'Giovanni wasted Team Rocket on money. I spent it on MINDS. Gym Leaders. Champions. A region that cannot disobey.',
            'I am Sabrina — Champion of Kanto, whether Kanto wills it or not. Your mind will make a fine addition.',
          ],
          win: [
            'Impossible. I saw every future... except the one where your will did not break.',
            'The leaders are waking. The region is waking. My empire of minds... undone by one stubborn rebel.',
            'Kanto is yours again. Champion.',
          ],
          lose: ['Kneel. Every mind kneels to me eventually — yours simply took longer.'],
        }),
      ],
    },
  ],
}
