const { supabase } = require('../config/config');

// 🎰 الرموز
const symbols = ["🍒", "🍋", "🍉", "7️⃣", "💎"];

// 🎲 توليد نتيجة
function getRandomSymbol() {
  return symbols[Math.floor(Math.random() * symbols.length)];
}

// 🧠 خوارزمية اللعبة
async function spin(user, bet) {
  // 🎯 تحقق من نظام الحظ
  const { data: luck } = await supabase
    .from('luck_control')
    .select('*')
    .eq('user_id', user.id)
    .single();

  let result = [];
  let winAmount = 0;

  // 🎯 ضربة حظ
  if (luck && luck.type === 'win' && luck.used_amount < luck.amount) {
    result = ["💎", "💎", "💎"];
    winAmount = bet * 5;

    await supabase
      .from('luck_control')
      .update({ used_amount: luck.used_amount + winAmount })
      .eq('id', luck.id);

  } 
  // 💀 حظ أوفر
  else if (luck && luck.type === 'lose' && luck.used_amount < luck.amount) {
    result = ["🍒", "🍋", "🍉"];
    winAmount = 0;

    await supabase
      .from('luck_control')
      .update({ used_amount: luck.used_amount + bet })
      .eq('id', luck.id);
  } 
  // 🎲 الوضع الطبيعي
  else {
    result = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];

    // 🧠 احتمالات ذكية (الربح قليل)
    if (result[0] === result[1] && result[1] === result[2]) {
      winAmount = bet * 3; // ربح متوسط
    } else if (result[0] === result[1] || result[1] === result[2]) {
      winAmount = bet * 1.5; // ربح بسيط
    } else {
      winAmount = 0; // خسارة
    }
  }

  return {
    result,
    winAmount
  };
}

module.exports = { spin };
