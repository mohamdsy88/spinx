// agentHandlers/agentPanel.js
const { bot, ADMIN_ID } = require('../config/config');
const {
  getUserByTelegramId, getUserByUniqueId, getUserById,
  updateBalance, getPlayersByAgent,
  saveRequest, countAgentRequests, countAgentTransfers,
  getRequestByRequestId, updateRequestStatus
} = require('../services/userService');
const { formatUSD, formatDate, generateRequestId } = require('../utils/helpers');
const { agentKeyboard, approveRejectKeyboard } = require('../keyboards/mainKeyboard');
const { getSession, setSession, deleteSession, updateSession } = require('../state/sessions');

// /agent
bot.onText(/\/agent/, async (msg) => {
  const user = await getUserByTelegramId(msg.from.id);
  if (!user || user.role !== 'agent') return;
  bot.sendMessage(msg.chat.id,
    `🧑‍💼 *لوحة الوكيل — SpinX*\n🔑 *ايديك:* \`${user.unique_id}\``,
    { parse_mode: 'Markdown', ...agentKeyboard() });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  callback_query — قبول/رفض طلب السحب
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
bot.on('callback_query', async (query) => {
  const data = query.data;
  if (!data.startsWith('withdraw_approve_') && !data.startsWith('withdraw_reject_')) return;

  const isApprove = data.startsWith('withdraw_approve_');
  const requestId = data.replace('withdraw_approve_', '').replace('withdraw_reject_', '');

  const req = await getRequestByRequestId(requestId);
  if (!req) {
    return bot.answerCallbackQuery(query.id, { text: '⚠️ الطلب غير موجود أو تم معالجته مسبقاً' });
  }

  const player = await getUserById(req.user_id);
  const agent  = await getUserByTelegramId(query.from.id);
  if (!player || !agent) return bot.answerCallbackQuery(query.id);

  const chatId = query.message.chat.id;

  if (isApprove) {
    // التحقق من رصيد اللاعب
    if (player.balance < req.amount) {
      return bot.answerCallbackQuery(query.id, { text: '❌ رصيد اللاعب غير كافٍ لتنفيذ السحب' });
    }

    const updatedPlayer = await updateBalance(player.id, -req.amount);
    const updatedAgent  = await updateBalance(agent.id,   req.amount);
    await updateRequestStatus(requestId, 'approved');

    // إزالة الأزرار
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: chatId,
      message_id: query.message.message_id
    });

    // إشعار الوكيل
    bot.sendMessage(chatId,
      `✅ *تم قبول طلب السحب بنجاح*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🆔 *رقم الطلب:* \`${requestId}\`\n` +
      `👤 *اللاعب:* ${player.full_name} | \`${player.unique_id}\`\n` +
      `💸 *المبلغ المسحوب من اللاعب:* ${formatUSD(req.amount)}\n` +
      `💼 *رصيدك الإجمالي الحالي:* ${formatUSD(updatedAgent.balance)}\n` +
      `📅 *التاريخ:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });

    // إشعار اللاعب
    bot.sendMessage(player.telegram_id,
      `✅ *تم قبول طلب السحب*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🆔 *رقم الطلب:* \`${requestId}\`\n` +
      `💸 *الرصيد المسحوب:* ${formatUSD(req.amount)}\n` +
      `💰 *رصيدك المتبقي:* ${formatUSD(updatedPlayer.balance)}\n` +
      `📅 *التاريخ:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });

  } else {
    // رفض الطلب
    await updateRequestStatus(requestId, 'rejected');

    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: chatId,
      message_id: query.message.message_id
    });

    // إشعار الوكيل
    bot.sendMessage(chatId,
      `❌ *تم رفض طلب السحب*\n🆔 *رقم الطلب:* \`${requestId}\``,
      { parse_mode: 'Markdown' });

    // إشعار اللاعب
    bot.sendMessage(player.telegram_id,
      `❌ *تم رفض طلب السحب*\n\n` +
      `🆔 *رقم الطلب:* \`${requestId}\`\n` +
      `📞 تواصل مع وكيلك للاستفسار`,
      { parse_mode: 'Markdown' });
  }

  bot.answerCallbackQuery(query.id);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  رسائل الوكيل
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
bot.on('message', async (msg) => {
  if (!msg.text) return;

  const user = await getUserByTelegramId(msg.from.id);
  if (!user || user.role !== 'agent') return;

  const chatId  = msg.chat.id;
  const text    = msg.text.trim();
  const session = getSession(chatId);

  // تجاهل إن كانت الجلسة تابعة لـ handler آخر
  if (session && !session.action?.startsWith('agent_')) return;

  // ──────────────────────────────────────────
  // 📥 طلب رصيد من الإدارة
  // ──────────────────────────────────────────
  if (text === "📥 طلب رصيد من الإدارة") {
    setSession(chatId, { action: 'agent_request_balance' });
    return bot.sendMessage(chatId,
      `💼 *رصيدك الحالي:* ${formatUSD(user.balance)}\n\n💰 أرسل المبلغ الذي تريده من الإدارة:`,
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'agent_request_balance') {
    const amount = Number(text);
    if (isNaN(amount) || amount <= 0) {
      return bot.sendMessage(chatId, "❌ مبلغ غير صحيح، أرسل رقماً موجباً");
    }

    const requestId = generateRequestId();
    await saveRequest({
      request_id: requestId,
      user_id:    user.id,
      agent_id:   user.id,
      type:       'deposit',
      amount
    });

    deleteSession(chatId);

    // إشعار الوكيل
    bot.sendMessage(chatId,
      `📨 *تم إرسال الطلب للإدارة بنجاح*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🆔 *رقم الطلب:* \`${requestId}\`\n` +
      `💰 *المبلغ المطلوب:* ${formatUSD(amount)}\n` +
      `🧑‍💼 *اسم الوكيل:* ${user.full_name || 'وكيل SpinX'}\n` +
      `⏳ *الحالة:* بانتظار موافقة الإدارة\n` +
      `📅 *التاريخ:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });

    // إشعار الأدمن مع أزرار قبول/رفض
    bot.sendMessage(ADMIN_ID,
      `📥 *طلب رصيد جديد من وكيل*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🧑‍💼 *الوكيل:* ${user.full_name || 'وكيل'} | \`${user.unique_id}\`\n` +
      `📱 *رقم الهاتف:* ${user.phone || 'غير متوفر'}\n` +
      `💰 *المبلغ المطلوب:* ${formatUSD(amount)}\n` +
      `🆔 *رقم الطلب:* \`${requestId}\`\n` +
      `📅 *التاريخ:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      {
        parse_mode: 'Markdown',
        ...approveRejectKeyboard('agentreq', requestId)
      });

    return;
  }

  // ──────────────────────────────────────────
  // 💸 تحويل رصيد للاعب
  // ──────────────────────────────────────────
  if (text === "💸 تحويل رصيد للاعب") {
    setSession(chatId, { action: 'agent_transfer' });
    return bot.sendMessage(chatId,
      "📨 أرسل *ايدي اللاعب* المراد تحويل الرصيد إليه:",
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'agent_transfer' && !session?.transfer_player) {
    const player = await getUserByUniqueId(text);
    if (!player || player.role !== 'player') {
      return bot.sendMessage(chatId, "❌ اللاعب غير موجود، تأكد من الايدي");
    }

    // تحقق أن اللاعب تابع لهذا الوكيل
    if (player.agent_id !== user.id) {
      return bot.sendMessage(chatId, "⚠️ هذا اللاعب ليس في فريقك");
    }

    updateSession(chatId, { transfer_player: player });

    return bot.sendMessage(chatId,
      `✅ *تم العثور على اللاعب*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 *الاسم:* ${player.full_name}\n` +
      `🆔 *الايدي:* \`${player.unique_id}\`\n` +
      `💰 *رصيده الحالي:* ${formatUSD(player.balance)}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💸 أرسل *المبلغ* المراد تحويله:`,
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'agent_transfer' && session?.transfer_player) {
    const amount = Number(text);
    if (isNaN(amount) || amount <= 0) {
      return bot.sendMessage(chatId, "❌ مبلغ غير صحيح، أرسل رقماً موجباً");
    }

    // جلب أحدث بيانات الوكيل للتحقق من الرصيد
    const freshAgent = await getUserByTelegramId(msg.from.id);
    if (freshAgent.balance < amount) {
      return bot.sendMessage(chatId,
        `❌ *رصيدك غير كافٍ*\n\n💼 *رصيدك الحالي:* ${formatUSD(freshAgent.balance)}`,
        { parse_mode: 'Markdown' });
    }

    const player        = session.transfer_player;
    const updatedAgent  = await updateBalance(user.id,   -amount);
    const updatedPlayer = await updateBalance(player.id,  amount);
    deleteSession(chatId);

    // إشعار الوكيل
    bot.sendMessage(chatId,
      `✅ *تمت عملية تحويل الرصيد بنجاح*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 *اللاعب:* ${player.full_name} | \`${player.unique_id}\`\n` +
      `💸 *المبلغ المضاف:* ${formatUSD(amount)}\n` +
      `💼 *رصيدك المتبقي:* ${formatUSD(updatedAgent.balance)}\n` +
      `📅 *التاريخ:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });

    // إشعار اللاعب
    bot.sendMessage(player.telegram_id,
      `💰 *تحديث على رصيدك*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `➕ *تمت إضافة رصيد إلى حسابك:* ${formatUSD(amount)}\n` +
      `💼 *رصيدك الجديد:* ${formatUSD(updatedPlayer.balance)}\n` +
      `🧑‍💼 *المرسل:* الوكيل\n` +
      `📅 *التاريخ:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });

    return;
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
  // 📊 إحصائياتي
  // ──────────────────────────────────────────
  if (text === "📊 إحصائياتي") {
    const myPlayers    = await getPlayersByAgent(user.id);
    const myRequests   = await countAgentRequests(user.id);
    const myTransfers  = await countAgentTransfers(user.id);

    const totalRequested   = myRequests.reduce((s, r) => s + Number(r.amount), 0);
    const totalTransferred = myTransfers.reduce((s, r) => s + Number(r.amount), 0);

    let playersList = '';
    if (myPlayers.length > 0) {
      playersList = myPlayers
        .map(p => `  • ${p.full_name || 'بدون اسم'} | \`${p.unique_id}\``)
        .join('\n');
    } else {
      playersList = '  لا يوجد لاعبون بعد';
    }

    return bot.sendMessage(chatId,
      `📊 *إحصائياتك — SpinX*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🎮 *عدد لاعبيك:* ${myPlayers.length}\n` +
      `${playersList}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📥 *عدد طلبات الرصيد من الإدارة:* ${myRequests.length}\n` +
      `💵 *إجمالي المبالغ المطلوبة:* ${formatUSD(totalRequested)}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💸 *عدد عمليات تحويل الرصيد للاعبين:* ${myTransfers.length}\n` +
      `💵 *إجمالي المبالغ المحوّلة:* ${formatUSD(totalTransferred)}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });
  }
});
