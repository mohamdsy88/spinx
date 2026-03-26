const { bot } = require('../config/config');
const { getUserByTelegramId, updateBalance } = require('../services/userService');
const { formatUSD, formatDate } = require('../utils/helpers');
const { playerKeyboard } = require('../keyboards/mainKeyboard');

// 🧠 جلسات اللاعب
const playerSessions = {};

// 👤 التعامل مع اللاعب
bot.on('message', async (msg) => {
  const user = await getUserByTelegramId(msg.from.id);

  if (!user || user.role !== 'player') return;

  const chatId = msg.chat.id;

  // 📋 عرض لوحة اللاعب
  if (msg.text === "/player") {
    return bot.sendMessage(chatId, "🎮 لوحة اللاعب", playerKeyboard());
  }

  // 💰 عرض الرصيد
  if (msg.text === "💰 التحقق من الرصيد") {
    return bot.sendMessage(
      chatId,
      `💼 رصيدك الحالي:

${formatUSD(user.balance)}`
    );
  }

  // 📤 طلب سحب
  if (msg.text === "📤 طلب سحب رصيد") {
    playerSessions[chatId] = { action: 'withdraw' };

    return bot.sendMessage(
      chatId,
      `💰 رصيدك الحالي: ${formatUSD(user.balance)}

📨 ارسل المبلغ الذي تريد سحبه`
    );
  }

  // إدخال مبلغ السحب
  if (playerSessions[chatId]?.action === 'withdraw') {
    const amount = Number(msg.text);
    if (isNaN(amount)) return;

    if (amount > user.balance) {
      return bot.sendMessage(
        chatId,
        `❌ لا تملك هذا الرصيد

💰 ${formatUSD(user.balance)}`
      );
    }

    const requestId = Math.floor(Math.random() * 999999);

    // 📨 إشعار اللاعب
    bot.sendMessage(
      chatId,
      `📨 تم إرسال طلب السحب

🆔 رقم الطلب: ${requestId}
💰 ${formatUSD(amount)}

📞 تواصل مع وكيلك لإكمال العملية`
    );

    // 🧑‍💼 إشعار الوكيل
    bot.sendMessage(
      user.agent_id,
      `📤 طلب سحب جديد

👤 اللاعب: ${user.full_name}
🆔 ${user.unique_id}
💰 ${formatUSD(amount)}
🆔 الطلب: ${requestId}
📅 ${formatDate()}`
    );

    delete playerSessions[chatId];
  }

  // 📞 تواصل مع الإدارة
  if (msg.text === "📞 تواصل مع الإدارة") {
    return bot.sendMessage(
      chatId,
      `📞 تواصل مع الإدارة:

@SpinXAdmin`
    );
  }

  // 🎮 بدء اللعب (مبدئي)
  if (msg.text === "🎮 ابدأ اللعب") {
    return bot.sendMessage(
      chatId,
      `🎰 قريباً سيتم تفعيل اللعبة!

🔥 استعد للربح`
    );
  }
});
