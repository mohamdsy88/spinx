const { bot } = require('../config/config');
const { getUserByTelegramId, updateBalance } = require('../services/userService');
const { spin } = require('../gameEngine/spinGame');
const { formatUSD } = require('../utils/helpers');

// 🎮 الرهانات
const bets = [0.10,0.25,0.50,1,2,3,4,5,6,7,8,9,10];

bot.on('message', async (msg) => {
  const user = await getUserByTelegramId(msg.from.id);

  if (!user || user.role !== 'player') return;

  const text = msg.text;
  const chatId = msg.chat.id;

  // 🎮 اختيار الرهان
  if (bets.includes(Number(text))) {
    const bet = Number(text);

    if (user.balance < bet) {
      return bot.sendMessage(chatId, "❌ رصيدك غير كافي");
    }

    // خصم الرهان
    await updateBalance(user.id, -bet);

    const { result, winAmount } = await spin(user, bet);

    if (winAmount > 0) {
      await updateBalance(user.id, winAmount);
    }

    bot.sendMessage(
      chatId,
      `🎰 ${result.join(" | ")}

💰 الرهان: ${formatUSD(bet)}
🏆 الربح: ${formatUSD(winAmount)}`
    );
  }
});
