// Boss fight rules, from ~/rick-platformer/STORY.md "Boss: Shrimp Rick". No drawing in here, only numbers,
// so the same rules can be run thousands of times by a test script to check the balance.
// All tuning lives in RULES. Change one value at a time.
export const RULES = {
  MORTY_HP: 60,
  BOSS_HP: 120,
  PHASE_2_AT: 60,        // boss HP at or below this: he calls the tank
  BANISH_AT: 15,         // boss HP at or below this: Shoot becomes Portal Banish (needs part 3)
  SHOOT_BASE: 10,
  SHOOT_PER_PART: 3,
  CLAW_SNAP: 8,
  TIDAL_SLAM: 25,
  KRILL_HIT: 4,
  KRILL_HITS: 3,
  ATTACK_DOWN_TURNS: 2,  // Talk in phase 1 halves his damage this long
  SLAM_CHANCE: 0.4,      // phase 2: how often he winds up a slam instead of sending krill
  // The timed Space press. Shooting: how much of the damage lands. Blocking: how much of a hit gets through.
  TIMING: { perfect: 1.5, good: 1, miss: 0.6 },
  BLOCK: 0.5,
};

// parts: how many gun parts Morty holds (0 to 3). phase 2 is used when retrying after a loss in phase 2.
export function newFight({ parts = 3, helpedResistance = false, rudeToMom = false, items = [], phase = 1 } = {}) {
  return {
    morty: { hp: RULES.MORTY_HP, max: RULES.MORTY_HP },
    boss: { hp: phase === 2 ? RULES.PHASE_2_AT : RULES.BOSS_HP, max: RULES.BOSS_HP },
    phase, parts, helpedResistance, rudeToMom,
    items: items.map((it) => ({ ...it })),
    defending: false,   // half damage this turn
    charged: false,     // next Shoot does double
    sauced: false,      // Morty's next shot is hard to aim
    shelled: false,     // blocks the next Shoot
    attackDown: 0,      // boss turns left at half damage
    bossSkip: false,
    slamReady: false,   // Tidal Slam lands on his next turn
    extraTurn: false,   // arcade soda: Morty goes again
    firstTankTurn: phase === 2,
    lastMove: '',       // he never uses Shell Up, Sauce Spray or the slam wind-up twice in a row
    talkUsed: { 1: false, 2: false },
  };
}

export const shootDamage = (s) => (RULES.SHOOT_BASE + RULES.SHOOT_PER_PART * s.parts) * (s.charged ? 2 : 1);
export const canBanish = (s) => s.phase === 2 && s.parts >= 3 && s.boss.hp <= RULES.BANISH_AT;

export function startMortyTurn(s) { s.defending = false; }

// quality: 'perfect', 'good' or 'miss' from the timed press. Returns what happened.
export function shoot(s, quality) {
  const sauced = s.sauced;
  s.sauced = false;
  if (sauced && quality === 'miss') return { missed: true };
  if (s.shelled) { s.shelled = false; return { blocked: true }; }
  const dmg = Math.round(shootDamage(s) * RULES.TIMING[quality]);
  s.charged = false;
  // He never drops to 0 from a normal shot: the fight ends with Portal Banish
  s.boss.hp = Math.max(1, s.boss.hp - dmg);
  return { dmg, crit: quality === 'perfect', weak: quality === 'miss' };
}

export function defend(s) { s.sauced = false; s.defending = true; s.charged = true; }

// Each phase has one Talk that works, once.
export function talk(s) {
  s.sauced = false;
  if (s.phase === 1 && !s.talkUsed[1] && s.helpedResistance) {
    s.talkUsed[1] = true; s.attackDown = RULES.ATTACK_DOWN_TURNS;
    return 'rebels';
  }
  if (s.phase === 2 && !s.talkUsed[2] && !s.rudeToMom) {
    s.talkUsed[2] = true; s.bossSkip = true;
    return 'plea';
  }
  return s.phase === 1 && !s.helpedResistance ? 'noRebels' : 'joke';
}

export function useItem(s, index) {
  s.sauced = false;
  const [it] = s.items.splice(index, 1);
  const before = s.morty.hp;
  s.morty.hp = Math.min(s.morty.max, s.morty.hp + (it.heal ?? 0));
  if (it.extraTurn) s.extraTurn = true;
  return { item: it, healed: s.morty.hp - before };
}

// Call after Morty's action. True when the boss just dropped into phase 2.
export function checkPhase2(s) {
  if (s.phase !== 1 || s.boss.hp > RULES.PHASE_2_AT) return false;
  s.phase = 2; s.shelled = false; s.firstTankTurn = true;
  s.boss.hp = RULES.PHASE_2_AT; // the tank water patches him up, so the tank phase is always a full 60 HP
  return true;
}

// What Shrimp Rick does this turn. rng() gives a number from 0 to 1.
export function bossChoose(s, rng = Math.random) {
  const move = pickMove(s, rng);
  s.lastMove = move;
  return move;
}

function pickMove(s, rng) {
  if (s.bossSkip) { s.bossSkip = false; s.slamReady = false; return 'skip'; }
  if (s.phase === 1) {
    const roll = rng();
    if (roll >= 0.5 && roll < 0.75 && !s.shelled && s.lastMove !== 'shell') { s.shelled = true; return 'shell'; }
    if (roll >= 0.75 && !s.sauced && s.lastMove !== 'sauce') { s.sauced = true; return 'sauce'; }
    return 'claw';
  }
  if (s.slamReady) { s.slamReady = false; return 'slam'; }
  // His first turn in the tank is always a wind-up, so the player sees the warning once before it matters.
  // Right after a slam he always sends krill, so every tank fight shows both attacks.
  if (s.firstTankTurn || (s.lastMove !== 'slam' && rng() < RULES.SLAM_CHANCE)) { s.firstTankTurn = false; s.slamReady = true; return 'windup'; }
  return 'krill';
}

// Damage one hit does to Morty. blocked: the player timed Space as it landed.
export function hitMorty(s, base, blocked, isSlam = false) {
  let d = base * (s.attackDown > 0 ? 0.5 : 1) * (s.defending ? 0.5 : 1) * (blocked ? RULES.BLOCK : 1);
  if (isSlam && s.defending && s.parts >= 2) d = 0; // the Fluid Canister lets the gun soak up the whole slam
  d = Math.ceil(d);
  s.morty.hp = Math.max(0, s.morty.hp - d);
  return d;
}

export function endBossTurn(s) { if (s.attackDown > 0) s.attackDown -= 1; }
