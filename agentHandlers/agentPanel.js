const { bot, ADMIN_ID } = require('../config/config');
const {
  getUserByTelegramId, getUserByUniqueId, getUserById,
  updateBalance, createRequest, updateRequestStatus,
  getRequestById, getAgentStats, logTransaction
} = require('../services/userService');
const { formatUSD, formatDate } = require('../utils/helpers');
const { agentKeyboard, approveRejectKeyboard } = require('../keyboards/mainKeyboard');

const agentSessions = {};

bot.on('message', async (msg) => {
  if (!msg.text) return;
  const user = await getUserByTelegramId(msg.from.id);
  if (!user || user.role !== 'agent') return;
  const chatId = msg.chat.id;
  const text = msg.text;

  if (user.is_blocked) return bot.sendMessage(chatId, '🚫 *حسابك في مرحلة التجميد*\nالرجاء التواصل مع الإدارة', { parse_mode: 'Markdown' });

  if (text === '/agent') return bot.sendMessage(chatId, `🧑‍💼 لوحة تحكم الوكيل\n\n💰 رصيدك: ${formatUSD(user.balance)}`, agentKeyboard());

  // 📥 طلب رصيد
  if (text === '📥 طلب رصيد من الإدارة') {
    agentSessions[chatId] = { action: 'request_balance' };
    return bot.sendMessage(chatId, `💰 *طلب رصيد من الإدارة*\n\n💼 رصيدك الحالي: ${formatUSD(user.balance)}\n\n📨 أرسل المبلغ الذي تريده:`, { parse_mode: 'Markdown' });
  }

  if (agentSessions[chatId]?.action === 'request_balance') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, '❌ الرجاء إدخال مبلغ صحيح');
    delete agentSessions[chatId];
    try {
      const request = await createRequest({ user_id: user.id, type: 'deposit', amount });
      const now = formatDate();
      bot.sendMessage(chatId,
        `✅ *تم تقديم طلبك للإدارة*\n\n━━━━━━━━━━━━━━━━━\n📋 رقم الطلب: \`${request.request_id}\`\n💰 المبلغ المطلوب: ${formatUSD(amount)}\n🧑‍💼 اسمك: ${user.full_name}\n⏰ ${now}\n━━━━━━━━━━━━━━━━━\n⏳ الرجاء الانتظار لمراجعة الطلب`,
        { parse_mode: 'Markdown' }
      );
      bot.sendMessage(ADMIN_ID,
        `📥 *طلب رصيد جديد من وكيل!*\n\n━━━━━━━━━━━━━━━━━\n🧑‍💼 الوكيل: ${user.full_name}\n🆔 ايديه: \`${user.unique_id}\`\n📞 هاتفه: ${user.phone || 'غير محدد'}\n💰 المبلغ المطلوب: ${formatUSD(amount)}\n📋 رقم الطلب: \`${request.request_id}\`\n⏰ ${now}\n━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown', ...approveRejectKeyboard('agent_deposit', request.request_id) }
      );
    } catch (err) { bot.sendMessage(chatId, '❌ حدث خطأ في تقديم الطلب'); }
    return;
  }

  // 💸 تحويل رصيد للاعب
  if (text === '💸 تحويل رصيد للاعب') {
    agentSessions[chatId] = { action: 'transfer' };
    return bot.sendMessage(chatId, `💸 *تحويل رصيد للاعب*\n\n💰 رصيدك الحالي: ${formatUSD(user.balance)}\n\n📨 أرسل ايدي اللاعب (6 أرقام):`, { parse_mode: 'Markdown' });
  }

  if (agentSessions[chatId]?.action === 'transfer' && !agentSessions[chatId].player) {
    const player = await getUserByUniqueId(text.trim());
    if (!player || player.role !== 'player') return bot.sendMessage(chatId, '❌ اللاعب غير موجود، تحقق من الايدي');
    if (player.agent_id !== user.id) return bot.sendMessage(chatId, '❌ هذا اللاعب ليس ضمن فريقك');
    agentSessions[chatId].player = player;
    return bot.sendMessage(chatId,
      `✅ *تم العثور على اللاعب*\n\n━━━━━━━━━━━━━━━━━\n👤 الاسم: ${player.full_name}\n🆔 ايديه: \`${player.unique_id}\`\n💰 رصيده الحالي: ${formatUSD(player.balance)}\n━━━━━━━━━━━━━━━━━\n💸 أرسل المبلغ الذي تريد تحويله:`,
      { parse_mode: 'Markdown' }
    );
  }

  if (agentSessions[chatId]?.action === 'transfer' && agentSessions[chatId].player) {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, '❌ الرجاء إدخال مبلغ صحيح');
    const freshAgent = await getUserByTelegramId(msg.from.id);
    if (Number(freshAgent.balance) < amount) {
      return bot.sendMessage(chatId, `❌ *رصيدك غير كافي!*\n\n💰 رصيدك الحالي: ${formatUSD(freshAgent.balance)}`, { parse_mode: 'Markdown' });
    }
    const player = agentSessions[chatId].player;
    delete agentSessions[chatId];
    try {
      const updatedAgent = await updateBalance(freshAgent.id, -amount);
      const updatedPlayer = await updateBalance(player.id, amount);
      await logTransaction({ from_user: freshAgent.id, to_user: player.id, amount, type: 'transfer' });
      const now = formatDate();
      bot.sendMessage(chatId,
        `✅ *تمت عملية التحويل بنجاح!*\n\n━━━━━━━━━━━━━━━━━\n👤 اللاعب: ${player.full_name}\n🆔 ايديه: \`${player.unique_id}\`\n💸 المبلغ المحوّل: ${formatUSD(amount)}\n💼 رصيدك الحالي: ${formatUSD(updatedAgent.balance)}\n⏰ ${now}\n━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
      bot.sendMessage(player.telegram_id,
        `💰 *تحديث على رصيدك!*\n\n━━━━━━━━━━━━━━━━━\n➕ تمت إضافة رصيد إلى حسابك\n💸 المبلغ المضاف: ${formatUSD(amount)}\n💼 رصيدك الجديد: ${formatUSD(updatedPlayer.balance)}\n🧑‍💼 المرسل: وكيلك\n⏰ ${now}\n━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) { bot.sendMessage(chatId, '❌ حدث خطأ في عملية التحويل'); }
    return;
  }

  // 💰 التحقق من الرصيد
  if (text === '💰 التحقق من الرصيد') {
    const freshAgent = await getUserByTelegramId(msg.from.id);
    return bot.sendMessage(chatId,
      `💼 *رصيدك الحالي*\n\n━━━━━━━━━━━━━━━━━\n💵 ${formatUSD(freshAgent.balance)}\n━━━━━━━━━━━━━━━━━\n🆔 ايديك: \`${freshAgent.unique_id}\``,
      { parse_mode: 'Markdown' }
    );
  }

  // 📊 الإحصائيات
  if (text === '📊 الإحصائيات') {
    const stats = await getAgentStats(user.id);
    const playersList = stats.players.length > 0
      ? stats.players.map(p => `  • ${p.full_name} (\`${p.unique_id}\`)`).join('\n')
      : '  لا يوجد لاعبون بعد';
    return bot.sendMessage(chatId,
      `📊 *إحصائياتك في SpinX*\n\n━━━━━━━━━━━━━━━━━\n👥 *عدد لاعبيك:* ${stats.players.length}\n${playersList}\n\n📥 *طلبات الرصيد من الإدارة:*\n  • عدد الطلبات: ${stats.requestCount}\n  • إجمالي المطلوب: ${formatUSD(stats.totalRequested)}\n\n💸 *عمليات التحويل للاعبين:*\n  • عدد العمليات: ${stats.transferCount}\n  • إجمالي المحوّل: ${formatUSD(stats.totalTransferred)}\n━━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' }
    );
  }
});

// قبول/رفض طلب رصيد الوكيل من الأدمن
bot.on('callback_query', async (query) => {
  const data = query.data;
  if (!data.startsWith('approve_agent_deposit_') && !data.startsWith('reject_agent_deposit_')) return;
  if (query.from.id.toString() !== ADMIN_ID) return bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح لك' });

  const isApprove = data.startsWith('approve_agent_deposit_');
  const requestId = data.replace(isApprove ? 'approve_agent_deposit_' : 'reject_agent_deposit_', '');
  const request = await getRequestById(requestId);
  if (!request) return bot.answerCallbackQuery(query.id, { text: '❌ الطلب غير موجود' });
  if (request.status !== 'pending') return bot.answerCallbackQuery(query.id, { text: '⚠️ تم معالجة هذا الطلب مسبقاً' });

  await bot.answerCallbackQuery(query.id);
  const agent = await getUserById(request.user_id);
  if (!agent) return;
  const now = formatDate();
  const amount = Number(request.amount);

  if (isApprove) {
    const updatedAgent = await updateBalance(agent.id, amount);
    await updateRequestStatus(requestId, 'approved');
    await logTransaction({ from_user: null, to_user: agent.id, amount, type: 'admin_deposit' });
    bot.editMessageText(
      `✅ *تم قبول طلب الوكيل*\n\n━━━━━━━━━━━━━━━━━\n📋 رقم الطلب: \`${requestId}\`\n🧑‍💼 الوكيل: ${agent.full_name}\n🆔 ايديه: \`${agent.unique_id}\`\n💸 المبلغ المضاف: ${formatUSD(amount)}\n💼 رصيد الوكيل الجديد: ${formatUSD(updatedAgent.balance)}\n⏰ ${now}\n━━━━━━━━━━━━━━━━━`,
      { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'Markdown' }
    );
    bot.sendMessage(agent.telegram_id,
      `✅ *تم قبول طلب الرصيد!*\n\n━━━━━━━━━━━━━━━━━\n📋 رقم الطلب: \`${requestId}\`\n💸 الرصيد المضاف: ${formatUSD(amount)}\n💼 رصيدك الحالي: ${formatUSD(updatedAgent.balance)}\n🏛️ الجهة المرسلة: الإدارة\n⏰ ${now}\n━━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await updateRequestStatus(requestId, 'rejected');
    bot.editMessageText(
      `❌ *تم رفض طلب الوكيل*\n\n━━━━━━━━━━━━━━━━━\n📋 رقم الطلب: \`${requestId}\`\n🧑‍💼 الوكيل: ${agent.full_name}\n💰 **...**

_This response is too long to display in full._
