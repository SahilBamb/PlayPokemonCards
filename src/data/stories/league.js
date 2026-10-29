// The League Reborn story: after Sabrina's Rocket empire fell, the freed Gym
// Leaders are back at their gyms and rebuilding — and every badge must be
// re-earned. But leftover Rocket remnants keep operating on someone's payroll,
// and the clues point to a far greater evil behind everything: Giovanni, the
// "ally" of the rebellion, who orchestrated it all to reclaim his throne.
// Played in the gymEra format (everything through Gym Challenge).
import GYM_LEADERS from '../gymLeaders.js'
import TRAINER_CLASSES from '../trainerClasses.js'

const leader = (id) => GYM_LEADERS.find((l) => l.id === id)
const tclassImg = (id) => TRAINER_CLASSES.find((t) => t.id === id)?.image ?? null
const rocketImg = (file) => `/trainers/TeamRocket/${file}.png`

const BLUE = { name: 'Blue', image: leader('kanto-blue')?.image }
const say = (who, text) => ({ name: who.name, image: who.image ?? null, text })
const REMNANT = { name: 'Rocket Remnant', image: rocketImg('Team Rocket Grunt Purple') }
const QUARTERMASTER = { name: 'League Quartermaster', image: tclassImg('oras-lady') }

// Regular gym-trainer node with a generated deck.
const trainer = (id, classId, name, { types, tier, aiId = 'aggro', intro, win, lose }) => ({
  id,
  kind: 'trainer',
  char: { name, image: tclassImg(classId) },
  aiId,
  deck: { gen: { types, tier } },
  rewards: { win: 40 + tier * 20, lose: 15 },
  dialogue: {
    intro: intro ?? [`${name} wants to battle!`],
    win: win ?? ['Whew! The gym is in good hands with trainers like you around.'],
    lose: lose ?? ['The League is back, and we train hard! Try again!'],
  },
})

// Named opponent with a hand-authored deck (leaders, remnants, Blue).
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

// A recovered Gym Leader defending their reopened gym.
const gymBoss = (id, leaderId, deckKey, { rewards, intro, win, lose }) =>
  named(id, 'boss', leader(leaderId).name, leader(leaderId).image, deckKey, { rewards, intro, win, lose })

export const LEAGUE_STORY = {
  id: 'league',
  name: 'League Reborn',
  description:
    'The Gym Leaders are free and rebuilding their gyms. Re-earn all eight badges. But someone kept paying Team Rocket, and the trail leads somewhere no one expects. Adds the Gym Heroes & Gym Challenge sets.',
  formatId: 'gymEra',
  packs: ['base1', 'jungle', 'fossil', 'rocket', 'gym1', 'gym2'],
  promoEvent: { packId: 'promoPack', chance: 0.12 },
  subPackEvent: { chance: 0.35 },
  startingCoins: 250,
  badgeBonus: 100,
  cover: leader('kanto-giovanni')?.badge?.image,
  bg: { tile: '/bg/league.svg', base: '#0e1218', wash: 'rgba(40, 70, 140, 0.10)' },
  shopkeeper: {
    name: 'League Quartermaster',
    image: tclassImg('oras-lady'),
    greeting:
      'Welcome to the official League supply post! The Gym Leaders donated their own cards to these Heroes and Challenge boosters. Every purchase helps rebuild the gyms.',
  },
  trophy: {
    name: 'League Reborn Trophy',
    image: null,
  },
  starterDecks: [
    {
      id: 'league-rock',
      name: 'Pewter Trainee',
      description: "Brock lends his spare Pokémon to promising rookies. Sturdy, patient, and hits like a landslide.",
      coverCards: ["Brock's Sandshrew", "Brock's Rhyhorn (Heroes 70)"],
      counts: {
        "Brock's Sandshrew": 4, "Brock's Sandslash (Challenge)": 2, "Brock's Geodude": 3, "Brock's Graveler (Challenge)": 2,
        "Brock's Mankey": 3, "Brock's Primeape": 2, "Brock's Rhyhorn (Heroes 70)": 3, "Brock's Vulpix": 3,
        Bill: 2, Potion: 2, Switch: 2, "Brock's Training Method": 2,
        'Fighting Energy': 26, 'Fire Energy': 4,
      },
    },
    {
      id: 'league-wave',
      name: 'Cerulean Trainee',
      description: "Misty's gym school teaches flow and patience. Ride the current and wear them down.",
      coverCards: ["Misty's Staryu", "Misty's Poliwag"],
      counts: {
        "Misty's Poliwag": 4, "Misty's Poliwhirl": 2, "Misty's Staryu": 3, "Misty's Starmie": 2,
        "Misty's Seel": 3, "Misty's Dewgong": 2, "Misty's Goldeen (Heroes 85)": 3, "Misty's Seaking": 2, "Misty's Psyduck": 1,
        Bill: 2, Potion: 2, Switch: 2, "Misty's Duel": 2,
        'Water Energy': 30,
      },
    },
    {
      id: 'league-flame',
      name: 'Cinnabar Trainee',
      description: "Blaine's crash course: burn fast, quiz later. Aggressive fire with a flock of Doduo.",
      coverCards: ["Blaine's Charmander", "Blaine's Ponyta"],
      counts: {
        "Blaine's Charmander": 4, "Blaine's Charmeleon": 2, "Blaine's Ponyta": 3, "Blaine's Rapidash": 2,
        "Blaine's Vulpix": 3, "Blaine's Growlithe (Heroes 62)": 3, "Blaine's Doduo": 3, "Blaine's Dodrio": 2,
        Bill: 2, Potion: 2, Switch: 2, "Blaine's Gamble": 2,
        'Fire Energy': 30,
      },
    },
  ],
  intro: [
    say(leader('kanto-brock'), 'The gyms are open again. After Sabrina... we owe the region a real League.'),
    say(leader('kanto-misty'), 'Badges given away are worthless. Re-earn them. Starting with us.'),
    say(REMNANT, 'You heroes finished the occupation? Cute. The paychecks never stopped coming.'),
    say(leader('kanto-brock'), 'Someone is still paying Team Rocket. Keep your eyes open.'),
    say(QUARTERMASTER, 'Official supply post! Heroes and Challenge boosters. Every purchase rebuilds a gym.'),
    say(leader('kanto-brock'), 'I set aside {starter} from the trainee locker. Pewter first. Stone by stone.'),
  ],
  areas: [
    {
      id: 'pewter',
      name: 'Pewter City',
      badge: leader('kanto-brock').badge,
      cutscene: [
        say(leader('kanto-brock'), 'Earned, this time. The Boulder Badge sits right.'),
        say(REMNANT, 'We got paid yesterday. YESTERDAY. Chew on that.'),
        say(leader('kanto-misty'), 'Cerulean is ready. Come make the harbor yours for real.'),
        say(leader('kanto-brock'), 'Watch for the letter G. The remnants keep saying it like a password.'),
      ],
      nodes: [
        trainer('lg-pewter-1', 'oras-camper', 'Camper Liam', {
          types: ['fighting'], tier: 1, aiId: 'random',
          intro: ['We are rebuilding the gym stone by stone!', "Brock says a battle a day keeps the rust away. Let's go!"],
        }),
        named('lg-pewter-2', 'mystery', 'Rocket Remnant', rocketImg('Team Rocket Grunt Purple'), 'remnantGrunt', {
          aiId: 'aggro',
          rewards: { win: 100, lose: 20 },
          intro: [
            'Hey! This rubble is Team Rocket salvage!',
            "Team Rocket's gone? Ha. The paychecks never stopped coming, kid.",
            "Someone's still running the show, and I don't ask questions!",
          ],
          win: ['Fine, take the salvage!', 'But I got paid yesterday. YESTERDAY. Chew on that.'],
          lose: ['Still getting paid, still winning. Best job I ever had.'],
        }),
        gymBoss('lg-pewter-boss', 'kanto-brock', 'gymBrock', {
          rewards: { win: 180, lose: 35 },
          intro: [
            'You came. After everything Sabrina made us do... the League owes you.',
            'But a badge given away is worth nothing. My gym is open again. Earn it, like everyone else!',
          ],
          win: [
            'Solid as bedrock. The Boulder Badge is yours, earned, this time.',
            "One thing bothers me though... the Rocket leftovers in town. Somebody's still paying them. Keep your eyes open.",
          ],
          lose: ['My rocks held firm. Train harder. The new League has standards!'],
        }),
      ],
    },
    {
      id: 'cerulean',
      name: 'Cerulean City',
      badge: leader('kanto-misty').badge,
      cutscene: [
        say(leader('kanto-misty'), 'Beautiful. Like watching the tide come in.'),
        say(leader('kanto-misty'), "A sailor told me their orders arrive sealed with a single letter: G."),
        say(leader('kanto-lt-surge'), "Vermilion's back online! Bring voltage, soldier!"),
        say(leader('kanto-brock'), 'The trail is getting louder. Stay sharp.'),
      ],
      nodes: [
        trainer('lg-cerulean-1', 'oras-swimmer-f', 'Swimmer Marina', {
          types: ['water'], tier: 1,
          intro: ['The gym pool is finally clean again!', 'Misty asked me to test every challenger. In you go!'],
        }),
        trainer('lg-cerulean-2', 'oras-fisherman', 'Fisherman Cole', {
          types: ['water'], tier: 1, aiId: 'stall',
          intro: ['I fished this harbor all through the occupation.', 'Patience won then. Patience wins now.'],
        }),
        gymBoss('lg-cerulean-boss', 'kanto-misty', 'gymMisty', {
          rewards: { win: 180, lose: 35 },
          intro: [
            "It's you! I never got to thank you properly for Cerulean Harbor.",
            "So here's my thanks: my real deck, my real gym, no mind control. The Cascade Badge. Take it if you can!",
          ],
          win: [
            'Beautiful! Like watching the tide come in. The Cascade Badge is yours.',
            "Oh, one more thing. The grunts you keep meeting? A sailor told me their orders arrive sealed with a single letter: 'G'.",
          ],
          lose: ['The current is stronger than it looks! Swim back when you are ready.'],
        }),
      ],
    },
    {
      id: 'vermilion',
      name: 'Vermilion City',
      badge: leader('kanto-lt-surge').badge,
      cutscene: [
        say(leader('kanto-lt-surge'), "HAH! You've grown, soldier!"),
        say(leader('kanto-lt-surge'), 'Steady pay. Old boss money, not new. Think about it.'),
        say(leader('kanto-erika'), "Celadon's garden is awake. Come smell the truth."),
        say(leader('kanto-misty'), 'G keeps showing up on the letterhead. I do not like it.'),
      ],
      nodes: [
        trainer('lg-vermilion-1', 'oras-guitarist', 'Guitarist Jax', {
          types: ['lightning'], tier: 2,
          intro: ["The gym's back online and the amps are LOUD!", 'Surge only takes challengers who survive the opening act!'],
        }),
        named('lg-vermilion-2', 'mystery', 'Blue', BLUE.image, 'rivalBlue', {
          aiId: 'aggro',
          rewards: { win: 130, lose: 25 },
          intro: [
            'Yo! Heard some rebel hero was collecting badges again. Figures it was you.',
            "I've been chasing the Rocket money trail. Warehouses, fake ledgers... it's big.",
            "Beat me and I'll keep you posted. Lose, and stay out of my investigation!",
          ],
          win: [
            'Tch! Fine, you win. Listen, the ledgers all route through Viridian.',
            "Somebody with serious money is playing puppet master. I'll dig deeper. Smell ya later!",
          ],
          lose: ['Hah! Leave the detective work to me. Smell ya later!'],
        }),
        gymBoss('lg-vermilion-boss', 'kanto-lt-surge', 'gymSurge', {
          rewards: { win: 200, lose: 40 },
          intro: [
            "Kid! Good to fight you WITHOUT a rebellion on the line for once.",
            "I rebuilt this gym with my own two hands. Nobody takes it from me again, especially not a rookie! Show me voltage!",
          ],
          win: [
            "HAH! You've grown, soldier! The Thunder Badge is yours!",
            'And hey, those remnants? Professional discipline, steady pay. That kind of money comes from an old boss, not a new one. Think about it.',
          ],
          lose: ['ZZZAP! The Lightning American stands tall! Recharge and return!'],
        }),
      ],
    },
    {
      id: 'celadon',
      name: 'Celadon City',
      badge: leader('kanto-erika').badge,
      cutscene: [
        say(leader('kanto-erika'), 'A guest ledger I never wrote. Someone used my gym as a bank.'),
        say(leader('kanto-erika'), 'The handwriting was not mine. It was practiced. Old.'),
        say(leader('kanto-koga'), 'Fuchsia hears whispers. Come, and listen in the dark.'),
        say(leader('kanto-brock'), 'Banks, paydays, a letter. This is not leftover chaos. This is a company.'),
      ],
      nodes: [
        trainer('lg-celadon-1', 'oras-aroma-lady', 'Aroma Lady Iris', {
          types: ['grass'], tier: 2, aiId: 'stall',
          intro: ['The gym garden is blooming again after that awful sleep.', 'Erika insists every challenger smells the roses... and survives them.'],
        }),
        trainer('lg-celadon-2', 'oras-beauty', 'Beauty Cassidy', {
          types: ['grass', 'colorless'], tier: 2,
          intro: ['Celadon is beautiful again, and so is my deck.', 'A quick battle before my photoshoot? Perfect lighting today.'],
        }),
        gymBoss('lg-celadon-boss', 'kanto-erika', 'gymErika', {
          rewards: { win: 200, lose: 40 },
          intro: [
            'Welcome back to Celadon Gym. The flowers remember the darkness... and so do I.',
            'I dreamed for months under her control. Now I am awake, and my garden defends itself. Shall we?',
          ],
          win: [
            'Wonderful. A battle with a clear mind is such a joy. The Rainbow Badge is yours.',
            'Before you go... while I slept, I kept a guest ledger I never wrote. Payments to the Game Corner basement, approved in handwriting I did not recognize. Someone used my gym as a bank.',
          ],
          lose: ['The garden is patient, dear. Come back when you have grown.'],
        }),
      ],
    },
    {
      id: 'fuchsia',
      name: 'Fuchsia City',
      badge: leader('kanto-koga').badge,
      cutscene: [
        say(leader('kanto-koga'), 'Magnificent. Kenji chose his allies well.'),
        say({ name: 'Remnant Officer', image: rocketImg('Team Rocket Manager') }, "The G seal was on the letterhead before Sabrina, during her, and after her."),
        say(leader('kanto-koga'), 'Saffron experiments predate her entirely. Tread carefully.'),
        say(leader('kanto-sabrina'), 'I am waiting. To atone and to warn you.'),
      ],
      nodes: [
        trainer('lg-fuchsia-1', 'oras-ninja-boy', 'Ninja Boy Kaito', {
          types: ['grass'], tier: 2,
          intro: ['Master Koga has returned and the clan trains day and night!', 'First lesson: never trust a quiet room!'],
        }),
        named('lg-fuchsia-2', 'mystery', 'Remnant Officer', rocketImg('Team Rocket Manager'), 'remnantOfficer', {
          rewards: { win: 140, lose: 28 },
          intro: [
            'You again. The hero. My grunts write reports about you.',
            "I ran payroll for the old Team Rocket, the REAL one, before Sabrina's little psychic circus.",
            "And I still do. The signature on my orders hasn't changed in ten years. Draw your own conclusions after I crush you.",
          ],
          win: [
            "Ugh. Fine. One professional courtesy, hero: Sabrina never signed anything. She never had to.",
            "The 'G' seal was on the letterhead before her, during her, and after her. The company never changed owners.",
          ],
          lose: ['Filed under: rebel, defeated. The organization endures.'],
        }),
        gymBoss('lg-fuchsia-boss', 'kanto-koga', 'gymKoga', {
          rewards: { win: 220, lose: 40 },
          intro: [
            'So. My son Kenji fought beside you while I was... elsewhere. My family owes you a debt.',
            'But debts are not badges. Fwahaha! Face the true master of Fuchsia: poison, shadow, and misdirection!',
          ],
          win: [
            'Magnificent. Kenji chose his allies well. The Soul Badge is yours.',
            'A ninja hears things. The remnants whisper of a benefactor in Viridian and of experiments in Saffron that predate Sabrina entirely. Tread carefully.',
          ],
          lose: ['Fwahaha! Vanish and reflect! The shadows will still be here.'],
        }),
      ],
    },
    {
      id: 'saffron',
      name: 'Saffron City',
      badge: leader('kanto-sabrina').badge,
      cutscene: [
        say(leader('kanto-sabrina'), 'The voice that taught me came from Viridian. From the man who "helped" you defeat me.'),
        say(leader('kanto-blaine'), 'Extra credit on Cinnabar! Come audit a lab!'),
        say(BLUE, "...I'm looking into this. Don't go to Viridian yet."),
        say(leader('kanto-sabrina'), 'Hurry. He has always been patient. He can afford to wait one more badge.'),
      ],
      nodes: [
        trainer('lg-saffron-1', 'oras-schoolkid-f', 'Schoolkid Mina', {
          types: ['psychic'], tier: 2, aiId: 'stall',
          intro: ['The gym reopened as a school. Miss Sabrina teaches ethics now. Really!', 'She says I must test every visitor. Pop quiz time!'],
        }),
        named('lg-saffron-2', 'mystery', 'Rocket Scientist', rocketImg('Team Rocket Pyschic Grunt'), 'rocketExperiment', {
          aiId: 'stall',
          rewards: { win: 150, lose: 30 },
          intro: [
            'No no no! Stay back! The specimen is unstable!',
            'Project M predates everything. Sabrina FOUND the lab, she never built it. The funding goes back years before her.',
            'It broke containment and it obeys only me now. Observe: RESULTS!',
          ],
          win: [
            'Impossible... the specimen yields to you?',
            "Take the files then. Cross-reference the funding: every grant traces to a shell company in Viridian. Founded by... no. Read it yourself.",
          ],
          lose: ['Fascinating. The specimen grows stronger with every battle. For science!'],
        }),
        gymBoss('lg-saffron-boss', 'kanto-sabrina', 'gymSabrina', {
          rewards: { win: 220, lose: 45 },
          intro: [
            'You. The one mind I could never bend.',
            'I remember every terrible thing I did as "Champion". I rebuilt this gym to atone and to remember.',
            'But understand this: I must know you are strong enough for what comes next. No mercy.',
          ],
          win: [
            'Yes... you are ready. The Marsh Badge is yours. Now listen carefully.',
            'The hunger for power that consumed me... it was planted. A voice taught me the mind-control technique, guided my rise, and vanished the day I fell.',
            'I finally traced the voice. It came from Viridian. It came from the man who "helped" you defeat me.',
          ],
          lose: ['I saw this outcome, and I hoped I was wrong. Grow stronger, for all our sakes.'],
        }),
      ],
    },
    {
      id: 'cinnabar',
      name: 'Cinnabar Island',
      badge: leader('kanto-blaine').badge,
      cutscene: [
        say(leader('kanto-blaine'), 'The research was commissioned years ago. Silph shares. A Viridian gym.'),
        say(BLUE, 'STOP. It was Giovanni. It was ALWAYS Giovanni.'),
        say(BLUE, 'He built the lab, planted Sabrina, then used you to clear his throne.'),
        say(BLUE, "I'll meet you at the gym door. Don't you dare go in underleveled."),
      ],
      nodes: [
        trainer('lg-cinnabar-1', 'oras-kindler', 'Kindler Ash', {
          types: ['fire'], tier: 3,
          intro: ['The lab fires are OUT and the gym fires are LIT!', 'Blaine rebuilt the whole island. Feel the warmth!'],
        }),
        trainer('lg-cinnabar-2', 'oras-expert-m', 'Expert Aldous', {
          types: ['fighting'], tier: 3,
          intro: ['I guarded this island during the occupation. Alone.', 'Blaine asked me to guard his gym now. Nobody passes without a fight.'],
        }),
        gymBoss('lg-cinnabar-boss', 'kanto-blaine', 'gymBlaine', {
          rewards: { win: 240, lose: 45 },
          intro: [
            'HAH! The kid who doused my brainwashed bonfire! Pop quiz: am I grateful?',
            'Answer: YES, but gratitude earns you nothing here! My mind is my own and it is FULL of fire! Final exam time!',
          ],
          win: [
            'CORRECT ANSWER! The Volcano Badge is yours!',
            'Now for extra credit: I audited my own lab after the occupation. The mind-control research Sabrina used? First commissioned here, YEARS ago... by the man who owned Silph shares and a Viridian gym. Go finish this, kid.',
          ],
          lose: ['WRONG! Study, retake, and this time show your work!'],
        }),
      ],
    },
    {
      id: 'viridian',
      name: 'Viridian City',
      badge: leader('kanto-giovanni').badge,
      cutscene: [
        say(leader('kanto-giovanni'), 'The design breaks. At my table. Ha... magnificent.'),
        say(BLUE, 'You actually did it.'),
        say(leader('kanto-giovanni'), 'No more proxies. The Earth Badge and the region are yours, Champion.'),
        say(leader('kanto-brock'), 'Then the League is truly reborn. Guard it better than we did.'),
        say(leader('kanto-misty'), "And if another G shows up... we'll be ready."),
      ],
      nodes: [
        named('lg-viridian-1', 'trainer', 'Rocket Elite Guard', rocketImg('Team Rocket Master'), 'rocketElite', {
          rewards: { win: 180, lose: 35 },
          intro: [
            'So the badges led you here. Of course they did. He planned it that way.',
            'I guard this door for the founder, the funder, the one true Boss. The legendary birds themselves wear his colors.',
            'You want the truth? Earn it.',
          ],
          win: ['...The door is open. He is expecting you.', 'He has always been expecting you.'],
          lose: ['The Boss chose his guard well. Leave.'],
        }),
        named('lg-viridian-2', 'mystery', 'Blue', BLUE.image, 'rivalBlue2', {
          rewards: { win: 200, lose: 40 },
          intro: [
            'STOP! Before you go in there! It was Giovanni. It was ALWAYS Giovanni.',
            'He built the mind-control lab. He planted the idea in Sabrina. He bankrolled her empire, then used YOU to tear it down when she got too strong.',
            "The rebellion, the liberation... all of it cleared his path back to the throne. And I can't let you face him underleveled. Full power, right now!",
          ],
          win: [
            "...Good. You're ready. I checked.",
            "He's in the gym, sitting on the Earth Badge like a crown. Go take it from him. I'll watch the door. Smell ya later!",
          ],
          lose: ['See? Not ready! Train up. Giovanni is beyond anything we have fought.'],
        }),
        gymBoss('lg-viridian-boss', 'kanto-giovanni', 'gymGiovanni', {
          rewards: { win: 500, lose: 60 },
          intro: [
            'Welcome, hero. Do sit down. You have earned that much.',
            'Yes. The technique was mine. Sabrina was my student, my proxy, and when she grew ambitious... my scapegoat. You removed her beautifully.',
            'The gyms reopened, the League reborn, the region grateful, and every thread runs through Viridian. Through me. The greater evil, as you call it, simply has better manners.',
            'One battle remains in my design. Defeat me and Kanto is truly free. Fail, and you were always working for me.',
          ],
          win: [
            '...So the design breaks. At MY table. Ha... haha... magnificent.',
            'No tricks, no proxies, no second organization in the shadows. You have beaten the man himself.',
            'The Earth Badge and the region are yours, Champion. Guard them better than I did.',
          ],
          lose: ['As designed. Even your defeat serves my purpose. Return when you can surprise me.'],
        }),
      ],
    },
  ],
}
