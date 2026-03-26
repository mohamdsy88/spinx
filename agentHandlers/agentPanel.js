const { bot } = require('../config/config');
const { 
  getUserByTelegramId, 
  getUserByUniqueId, 
  updateBalance 
} = require('../services/userService');
const { formatUSD, formatDate } = require('../utils/helpers');
const { agentKeyboard } = require('../keyboards/mainKeyboard');

// 🧠 جلسات الوكيل
const agentSessions = {};

// 🧑‍💼 عرض لوحة الوكيل تلقائي
bot.on('message', async (msg) => {
  const user = await getUserByTelegramId(msg.from.id);

  if (!user || user.role !== 'agent') return;

  if (msg.text === "/agent") {
    return bot.sendMessage(msg.chat.id, "🧑‍💼 لوحة الوكيل", agentKeyboard());
  }

  const chatId = msg.chat.id;

  // 📥 طلب رصيد
  if (msg.text === "📥 طلب رصيد من الإدارة") {
    agentSessions[chatId] = { action: 'request_balance' };

    return bot.sendMessage(chatId, "💰 ارسل المبلغ الذي تريده");
  }

  if (agentSessions[chatId]?.action === 'request_balance') {
    const amount = Number(msg.text);
    if (isNaN(amount)) return;

    const requestId = Math.floor(Math.random() * 999999);

    bot.sendMessage(
      chatId,
      `📨 تم إرسال الطلب

🆔 رقم الطلب: ${requestId}
💰 ${formatUSD(amount)}
⏳ بانتظار موافقة الإدارة`
    );

    // 👑 إرسال للأدمن (بدون أزرار حالياً)
    bot.sendMessage(
      process.env.ADMIN_ID,
      `📥 طلب رصيد جديد

🧑‍💼 الوكيل: ${user.unique_id}
💰 ${formatUSD(amount)}
🆔 ${requestId}
📅 ${formatDate()}`
    );

    delete agentSessions[chatId];
  }

  // 💸 تحويل رصيد للاعب
  if (msg.text === "💸 تحويل رصيد للاعب") {
    agentSessions[chatId] = { action: 'transfer' };

    return bot.sendMessage(chatId, "📨 ارسل ايدي اللاعب");
  }

  // إدخال ID اللاعب
  if (agentSessions[chatId]?.action === 'transfer' && !agentSessions[chatId].player) {
    const player = await getUserByUniqueId(msg.text);

    if (!player || player.role !== 'player') {
      return bot.sendMessage(chatId, "❌ اللاعب غير موجود");
    }

    agentSessions[chatId].player = player;

    return bot.sendMessage(
      chatId,
      `✅ تم العثور على اللاعب

👤 ${player.full_name}
🆔 ${player.unique_id}

💰 ارسل المبلغ`
    );
  }

  // إدخال المبلغ
  if (agentSessions[chatId]?.player && !agentSessions[chatId].amount) {
    const amount = Number(msg.text);
    if (isNaN(amount)) return;

    // التحقق من رصيد الوكيل
    if (user.balance < amount) {
      return bot.sendMessage(
        chatId,
        `❌ رصيدك غير كافي

💰 ${formatUSD(user.balance)}`
      );
    }

    // خصم من الوكيل
    await updateBalance(user.id, -amount);

    // إضافة للاعب
    const updatedPlayer = await updateBalance(agentSessions[chatId].player.id, amount);

    // 🧑‍💼 إشعار الوكيل
    bot.sendMessage(
      chatId,
      `✅ تمت العملية

👤 اللاعب: ${updatedPlayer.full_name}
💰 ${formatUSD(amount)}
📅 ${formatDate()}`
    );

    // 👤 إشعار اللاعب
    bot.sendMessage(
      updatedPlayer.telegram_id,
      `💰 تم إضافة رصيد

➕ ${formatUSD(amount)}
💼 رصيدك: ${formatUSD(updatedPlayer.balance)}
📅 ${formatDate()}`
    );

    delete agentSessions[chatId];
  }

  // 💰 عرض الرصيد
  if (msg.text === "💰 التحقق من الرصيد") {
    return bot.sendMessage(
      chatId,
      `💼 رصيدك الحالي:

${formatUSD(user.balance)}`
    );
  }
});
