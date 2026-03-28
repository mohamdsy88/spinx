// playerHandlers/playerPanel.js
const { bot } = require('../config/config');
const {
  getUserByTelegramId, getUserById,
  updateBalance, saveRequest
} = require('../services/userService');
const { formatUSD, formatDate, generateRequestId } = require('../utils/helpers');
const { playerKeyboard, betKeyboard, approveRejectKeyboard } = require('../keyboards/mainKeyboard');
const { spin } = require('../gameEngine/spinGame');
const { getSession, setSession, deleteSession } = require('../state/sessions');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  رسائل اللاعب
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
bot.on('message', async (msg) => {
  if (!msg.text) return;

  const user = await getUserByTelegramId(msg.from.id);
  if (!user || user.role !== 'player') return;

  const chatId  = msg.chat.id;
  const text    = msg.text.trim();
  const session = getSession(chatId);

  // تجاهل إن كانت الجلسة تابعة لـ handler آخر
  if (session && !session.action?.startsWith('player_')) return;

  // ──────────────────────────────────────────
  // ❌ إلغاء الأمر
  // ──────────────────────────────────────────
  if (text === 'الغاء' || text === 'إلغاء') {
    deleteSession(chatId);
    return bot.sendMessage(chatId,
      "❎ *تم إلغاء العملية الحالية*",
      { parse_mode: 'Markdown', ...playerKeyboard() });
  }

  // حساب مجمد
  if (user.is_blocked) {
    return bot.sendMessage(chatId,
      "🚫 *حسابك في مرحلة التجميد*\nالرجاء التواصل مع الإدارة:\n@SpinXAdmin",
      { parse_mode: 'Markdown' });
  }

  // ──────────────────────────────────────────
  // 👤 بياناتي
  // ──────────────────────────────────────────
  if (text === "👤 بياناتي") {
    const agent = user.agent_id ? await getUserById(user.agent_id) : null;

    return bot.sendMessage(chatId,
      `👤 *بيانات حسابك في SpinX*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📛 *الاسم الكامل:* ${user.full_name || 'غير متوفر'}\n` +
      `🆔 *ايدي حسابك:* \`${user.unique_id}\`\n` +
      `📱 *رقم الهاتف:* ${user.phone || 'غير متوفر'}\n` +
      `💰 *الرصيد الحالي:* ${formatUSD(user.balance)}\n` +
      `🧑‍💼 *الوكيل:* ${agent ? `${agent.full_name || 'وكيل SpinX'} | \`${agent.unique_id}\`` : 'غير متوفر'}\n` +
      `📅 *تاريخ إنشاء الحساب:* ${formatDate(new Date(user.created_at))}\n` +
      `🔰 *حالة الحساب:* ${user.is_blocked ? '❄️ مجمد' : '✅ نشط'}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });
  }

  // ──────────────────────────────────────────
  // 💰 رصيدي
  // ──────────────────────────────────────────
  if (text === "💰 رصيدي") {
    return bot.sendMessage(chatId,
      `💼 *رصيدك الحالي*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `${formatUSD(user.balance)}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });
  }

  // ──────────────────────────────────────────
  // 🎮 ابدأ اللعب
  // ──────────────────────────────────────────
  if (text === "🎮 ابدأ اللعب") {
    if (user.balance <= 0) {
      return bot.sendMessage(chatId,
        "❌ *رصيدك غير كافٍ للعب*\nتواصل مع وكيلك لإضافة رصيد 💵",
        { parse_mode: 'Markdown' });
    }

    setSession(chatId, { action: 'player_game' });
    return bot.sendMessage(chatId,
      `🎰 *مرحباً في SpinX Slots!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 *رصيدك:* ${formatUSD(user.balance)}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🎯 *اختر مبلغ الرهان:*\n` +
      `_(أرسل "الغاء" للخروج)_`,
      { parse_mode: 'Markdown', ...betKeyboard() });
  }

  // ──────────────────────────────────────────
  // 📤 طلب سحب رصيد
  // ──────────────────────────────────────────
  if (text === "📤 طلب سحب رصيد") {
    if (user.balance <= 0) {
      return bot.sendMessage(chatId,
        "❌ *رصيدك صفر*، لا يمكن تقديم طلب سحب",
        { parse_mode: 'Markdown' });
    }

    setSession(chatId, { action: 'player_withdraw' });
    return bot.sendMessage(chatId,
      `💼 *رصيدك الحالي:* ${formatUSD(user.balance)}\n\n` +
      `📨 أرسل المبلغ الذي تريد سحبه:\n_(أرسل "الغاء" للإلغاء)_`,
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'player_withdraw') {
    const amount = Number(text);
    if (isNaN(amount) || amount <= 0) {
      return bot.sendMessage(chatId,
        "❌ مبلغ غير صحيح، أرسل رقماً موجباً\n_(أرسل \"الغاء\" للإلغاء)_");
    }

    if (amount > user.balance) {
      return bot.sendMessage(chatId,
        `❌ *المبلغ يتجاوز رصيدك*\n\n💰 *رصيدك الحالي:* ${formatUSD(user.balance)}`,
        { parse_mode: 'Markdown' });
    }

    const requestId = generateRequestId();
    const agent     = await getUserById(user.agent_id);

    await saveRequest({
      request_id: requestId,
      user_id:    user.id,
      agent_id:   user.agent_id,
      type:       'withdraw',
      amount
    });

    deleteSession(chatId);

    bot.sendMessage(chatId,
      `📨 *تم إرسال طلب السحب*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🆔 *رقم الطلب:* \`${requestId}\`\n` +
      `💸 *المبلغ المطلوب سحبه:* ${formatUSD(amount)}\n` +
      `📞 *تواصل مع وكيلك لإكمال العملية*\n` +
      `📅 *التاريخ:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });

    if (agent) {
      bot.sendMessage(agent.telegram_id,
        `📤 *طلب سحب رصيد جديد*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `👤 *اللاعب:* ${user.full_name} | \`${user.unique_id}\`\n` +
        `💸 *المبلغ المراد سحبه:* ${formatUSD(amount)}\n` +
        `🆔 *رقم الطلب:* \`${requestId}\`\n` +
        `📅 *التاريخ:* ${formatDate()}\n` +
        `━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown', ...approveRejectKeyboard('withdraw', requestId) });
    }

    return;
  }

  // ──────────────────────────────────────────
  // 📞 تواصل مع الإدارة
  // ──────────────────────────────────────────
  if (text === "📞 تواصل مع الإدارة") {
    return bot.sendMessage(chatId,
      `📞 *للتواصل مع إدارة SpinX:*\n\n@SpinXAdmin`,
      { parse_mode: 'Markdown' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  callback_query — اللعبة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
bot.on('callback_query', async (query) => {
  const data   = query.data;
  const chatId = query.message.chat.id;

  if (data === 'exit_game') {
    deleteSession(chatId);
    bot.answerCallbackQuery(query.id, { text: '👋 تم الخروج من اللعبة' });
    return bot.sendMessage(chatId,
      "👋 *تم الخروج من اللعبة*\nيمكنك العودة في أي وقت!",
      { parse_mode: 'Markdown', ...playerKeyboard() });
  }

  if (!data.startsWith('bet_')) return;

  const user = await getUserByTelegramId(query.from.id);
  if (!user || user.role !== 'player') return bot.answerCallbackQuery(query.id);

  if (user.is_blocked) {
    return bot.answerCallbackQuery(query.id, { text: '🚫 حسابك مجمد، تواصل مع الإدارة' });
  }

  const bet = Number(data.replace('bet_', ''));

  if (user.balance < bet) {
    return bot.answerCallbackQuery(query.id, {
      text: `❌ رصيدك غير كافٍ! رصيدك: ${user.balance.toFixed(2)} دولار`
    });
  }

  bot.answerCallbackQuery(query.id, { text: '🎰 جاري التدوير...' });

  await updateBalance(user.id, -bet);
  const freshUser = await getUserByTelegramId(query.from.id);
  const { result, winAmount } = await spin(freshUser, bet);

  let updatedUser;
  if (winAmount > 0) {
    updatedUser = await updateBalance(freshUser.id, winAmount);
  } else {
    updatedUser = await getUserByTelegramId(query.from.id);
  }

  const net = winAmount - bet;

  let resultMsg = `🎰 *SpinX Slots*\n\n`;
  resultMsg += `${result.join('  ')}\n\n`;
  resultMsg += `━━━━━━━━━━━━━━━━\n`;
  resultMsg += `💰 *الرهان:* ${formatUSD(bet)}\n`;

  if (winAmount > 0) {
    resultMsg += `🏆 *ربحت:* ${formatUSD(winAmount)}\n`;
    if (net > 0) resultMsg += `📈 *الصافي:* +${formatUSD(net)}\n`;
  } else {
    resultMsg += `💸 *خسرت الرهان*\n`;
  }

  resultMsg += `━━━━━━━━━━━━━━━━\n`;
  resultMsg += `💼 *رصيدك الحالي:* ${formatUSD(updatedUser.balance)}\n`;
  resultMsg += `━━━━━━━━━━━━━━━━\n`;

  if (updatedUser.balance <= 0) {
    deleteSession(chatId);
    return bot.sendMessage(chatId,
      resultMsg + `⚠️ *رصيدك انتهى!*\nتواصل مع وكيلك لإضافة رصيد 💵`,
      { parse_mode: 'Markdown', ...playerKeyboard() });
  }

  resultMsg += `🎯 *اختر رهانك التالي:*`;

  bot.sendMessage(chatId, resultMsg, {
    parse_mode: 'Markdown',
    ...betKeyboard()
  });
});
