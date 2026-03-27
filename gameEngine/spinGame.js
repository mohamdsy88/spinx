// gameEngine/spinGame.js
const { getLuckControl, updateLuckUsed, deleteLuckControl } = require('../services/userService');

// 🎰 الرموز
const SYMBOLS = {
  cherry:  "🍒",
  lemon:   "🍋",
  orange:  "🍊",
  grape:   "🍇",
  bell:    "🔔",
  seven:   "7️⃣",
  diamond: "💎"
};

// مضاعفات الفوز عند ثلاثة متماثلة
const COMBO_MULT = {
  "💎": 10,
  "7️⃣": 7,
  "🔔": 5,
  "🍇": 4,
  "🍊": 3,
  "🍒": 2.5,
  "🍋": 2
};

const ALL_SYMBOLS = Object.values(SYMBOLS);

function randomSymbol() {
  return ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)];
}

// الخوارزمية الأساسية — البيت يربح أكثر (هامش 35%)
function houseAlgorithm(bet) {
  const rand = Math.random();

  // 60% خسارة كاملة
  if (rand < 0.60) {
    const a = randomSymbol();
    let b, c;
    do { b = randomSymbol(); } while (b === a);
    do { c = randomSymbol(); } while (c === a || c === b);
    return { result: [a, b, c], winAmount: 0 };
  }

  // 20% ربح خفيف — اثنان متماثلان (x1.3)
  if (rand < 0.80) {
    const s = randomSymbol();
    let other;
    do { other = randomSymbol(); } while (other === s);
    const combo = Math.random() > 0.5 ? [s, s, other] : [other, s, s];
    return { result: combo, winAmount: +(bet * 1.3).toFixed(2) };
  }

  // 12% ربح متوسط — ثلاثة متماثلة فاكهة منخفضة
  if (rand < 0.92) {
    const low = [SYMBOLS.lemon, SYMBOLS.cherry, SYMBOLS.orange];
    const s   = low[Math.floor(Math.random() * low.length)];
    const mult = COMBO_MULT[s] || 2;
    return { result: [s, s, s], winAmount: +(bet * mult).toFixed(2) };
  }

  // 6% ربح كبير — عنب أو جرس
  if (rand < 0.98) {
    const high = [SYMBOLS.grape, SYMBOLS.bell];
    const s    = high[Math.floor(Math.random() * high.length)];
    const mult = COMBO_MULT[s] || 4;
    return { result: [s, s, s], winAmount: +(bet * mult).toFixed(2) };
  }

  // 2% جاكبوت نادر — سبعة أو ألماس
  const jackpots = [SYMBOLS.seven, SYMBOLS.diamond];
  const s   = jackpots[Math.floor(Math.random() * jackpots.length)];
  const mult = COMBO_MULT[s] || 7;
  return { result: [s, s, s], winAmount: +(bet * mult).toFixed(2) };
}

// ضربة حظ — فوز مضمون حتى الهدف
function luckyWinSpin(bet) {
  const high = [SYMBOLS.bell, SYMBOLS.seven, SYMBOLS.diamond];
  const s    = high[Math.floor(Math.random() * high.length)];
  const mult = COMBO_MULT[s] || 5;
  return { result: [s, s, s], winAmount: +(bet * mult).toFixed(2) };
}

// حظ أوفر — خسارة مضمونة حتى الهدف
function badLuckSpin() {
  return {
    result: [SYMBOLS.cherry, SYMBOLS.lemon, SYMBOLS.orange],
    winAmount: 0
  };
}

async function spin(user, bet) {
  const luck = await getLuckControl(user.id);

  // ضربة حظ نشطة
  if (luck && luck.type === 'win' && luck.used_amount < luck.amount) {
    const { result, winAmount } = luckyWinSpin(bet);
    const newUsed = luck.used_amount + winAmount;

    if (newUsed >= luck.amount) {
      await deleteLuckControl(user.id);
    } else {
      await updateLuckUsed(luck.id, newUsed);
    }

    return { result, winAmount };
  }

  // حظ أوفر نشط
  if (luck && luck.type === 'lose' && luck.used_amount < luck.amount) {
    const { result } = badLuckSpin();
    const newUsed = luck.used_amount + bet;

    if (newUsed >= luck.amount) {
      await deleteLuckControl(user.id);
    } else {
      await updateLuckUsed(luck.id, newUsed);
    }

    return { result, winAmount: 0 };
  }

  // وضع عادي
  return houseAlgorithm(bet);
}

module.exports = { spin };
