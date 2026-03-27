// adminHandlers/adminPanel.js
const { bot, ADMIN_ID } = require('../config/config');
const {
  getUserByUniqueId, getUserById, updateBalance,
  createAgent, blockUser, unblockUser,
  getAllPlayers, getAllAgents, getAllUsers,
  setLuckControl, saveRequest, getRequestByRequestId, updateRequestStatus
} = require('../services/userService');
const { formatUSD, formatDate, generateRequestId } = require('../utils/helpers');
const { adminKeyboard, targetTypeKeyboard, approveRejectKeyboard } = require('../keyboards/mainKeyboard');
const { getSession, setSession, deleteSession, updateSession } = require('../state/sessions');

const ADMIN = ADMIN_ID.toString();

function isAdmin(msg) {
  return msg.from.id.toString() === ADMIN;
}

// 👑 /admin
bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg)) return;
  bot.sendMessage(msg.chat.id, "👑 *لوحة تحكم الأدمن — SpinX*", {
    parse_mode: 'Markdown',
    ...adminKeyboard()
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  callback_query للأدمن
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  if (chatId.toString() !== ADMIN) return;

  const data = query.data;

  // اختيار نوع الهدف لإضافة رصيد
  if (data === 'bal_player' || data === 'bal_agent') {
    updateSession(chatId, {
      action: 'add_balance',
      target_role: data === 'bal_player' ? 'player' : 'agent'
    });
    bot.answerCallbackQuery(query.id);
    return bot.sendMessage(chatId,
      `📨 أرسل *ايدي ${data === 'bal_player' ? 'اللاعب' : 'الوكيل'}*:`,
      { parse_mode: 'Markdown' });
  }

  // اختيار نوع الهدف لخصم رصيد
  if (data === 'deduct_player' || data === 'deduct_agent') {
    updateSession(chatId, {
      action: 'deduct_balance',
      target_role: data === 'deduct_player' ? 'player' : 'agent'
    });
    bot.answerCallbackQuery(query.id);
    return bot.sendMessage(chatId,
      `📨 أرسل *ايدي ${data === 'deduct_player' ? 'اللاعب' : 'الوكيل'}*:`,
      { parse_mode: 'Markdown' });
  }

  // قبول/رفض طلب رصيد الوكيل
  if (data.startsWith('agentreq_approve_') || data.startsWith('agentreq_reject_')) {
    const isApprove = data.startsWith('agentreq_approve_');
    const requestId = data.replace('agentreq_approve_', '').replace('agentreq_reject_', '');

    const req = await getRequestByRequestId(requestId);
    if (!req) {
      return bot.answerCallbackQuery(query.id, { text: '⚠️ الطلب غير موجود أو تم معالجته' });
    }

    const agent = await getUserById(req.user_id);
    if (!agent) return bot.answerCallbackQuery(query.id, { text: '⚠️ الوكيل غير موجود' });

    if (isApprove) {
      const updatedAgent = await updateBalance(agent.id, req.amount);
      await updateRequestStatus(requestId, 'approved');

      bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: chatId, message_id: query.message.message_id
      });

      bot.sendMessage(chatId,
        `✅ *تم قبول طلب رصيد الوكيل*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `🆔 *رقم الطلب:* \`${requestId}\`\n` +
        `🧑‍💼 *الوكيل:* ${agent.full_name || 'وكيل'} | \`${agent.unique_id}\`\n` +
        `💰 *المبلغ المضاف:* ${formatUSD(req.amount)}\n` +
        `💼 *رصيد الوكيل الجديد:* ${formatUSD(updatedAgent.balance)}\n` +
        `📅 *التاريخ:* ${formatDate()}\n` +
        `━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' });

      bot.sendMessage(agent.telegram_id,
        `💰 *تحديث على رصيدك*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `✅ *تم قبول طلب إضافة رصيد*\n` +
        `🆔 *رقم الطلب:* \`${requestId}\`\n` +
        `💵 *الرصيد المضاف:* ${formatUSD(req.amount)}\n` +
        `💼 *رصيدك الحالي:* ${formatUSD(updatedAgent.balance)}\n` +
        `🏦 *الجهة المرسلة:* الإدارة\n` +
        `📅 *التاريخ:* ${formatDate()}\n` +
        `━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' });
    } else {
      await updateRequestStatus(requestId, 'rejected');

      bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: chatId, message_id: query.message.message_id
      });

      bot.sendMessage(chatId,
        `❌ *تم رفض طلب رصيد الوكيل*\n🆔 \`${requestId}\``,
        { parse_mode: 'Markdown' });

      bot.sendMessage(agent.telegram_id,
        `❌ *تم رفض طلب إضافة الرصيد*\n\n` +
        `🆔 *رقم الطلب:* \`${requestId}\`\n` +
        `📞 الرجاء التواصل مع الإدارة للاستفسار`,
        { parse_mode: 'Markdown' });
    }

    return bot.answerCallbackQuery(query.id);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  رسائل الأدمن
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
bot.on('message', async (msg) => {
  if (!isAdmin(msg) || !msg.text) return;

  const chatId  = msg.chat.id;
  const text    = msg.text.trim();
  const session = getSession(chatId);

  // ──────────────────────────────────────────
  // ➕ إضافة رصيد
  // ──────────────────────────────────────────
  if (text === "➕ إضافة رصيد") {
    setSession(chatId, { action: 'add_balance' });
    return bot.sendMessage(chatId, "📨 *اختر نوع الحساب:*", {
      parse_mode: 'Markdown',
      ...targetTypeKeyboard('bal')
    });
  }

  // ──────────────────────────────────────────
  // ➖ خصم رصيد
  // ──────────────────────────────────────────
  if (text === "➖ خصم رصيد") {
    setSession(chatId, { action: 'deduct_balance' });
    return bot.sendMessage(chatId, "📨 *اختر نوع الحساب:*", {
      parse_mode: 'Markdown',
      ...targetTypeKeyboard('deduct')
    });
  }

  // إدخال الايدي بعد اختيار النوع
  if (
    (session?.action === 'add_balance' || session?.action === 'deduct_balance') &&
    session?.target_role &&
    !session?.target_user
  ) {
    const target = await getUserByUniqueId(text);
    if (!target || target.role !== session.target_role) {
      return bot.sendMessage(chatId,
        `❌ الحساب غير موجود أو النوع غير صحيح\nتأكد من إدخال ايدي ${session.target_role === 'player' ? 'لاعب' : 'وكيل'}`);
    }

    const agentInfo = (session.target_role === 'player' && target.agent_id)
      ? await getUserById(target.agent_id) : null;

    updateSession(chatId, { target_user: target });

    let info = `✅ *تم العثور على الحساب*\n\n━━━━━━━━━━━━━━━━\n`;
    info += `👤 *الاسم:* ${target.full_name || 'بدون اسم'}\n`;
    info += `🆔 *الايدي:* \`${target.unique_id}\`\n`;
    info += `💰 *الرصيد الحالي:* ${formatUSD(target.balance)}\n`;
    if (agentInfo) info += `🧑‍💼 *الوكيل:* ${agentInfo.full_name || 'وكيل'} | \`${agentInfo.unique_id}\`\n`;
    info += `━━━━━━━━━━━━━━━━\n💸 *أرسل المبلغ:*`;

    return bot.sendMessage(chatId, info, { parse_mode: 'Markdown' });
  }

  // إدخال المبلغ لإضافة/خصم
  if (
    (session?.action === 'add_balance' || session?.action === 'deduct_balance') &&
    session?.target_user
  ) {
    const amount = Number(text);
    if (isNaN(amount) || amount <= 0) {
      return bot.sendMessage(chatId, "❌ مبلغ غير صحيح، أرسل رقماً موجباً");
    }

    const isAdd   = session.action === 'add_balance';
    const target  = session.target_user;
    const sign    = isAdd ? amount : -amount;
    const updated = await updateBalance(target.id, sign);

    deleteSession(chatId);

    const actionText = isAdd ? 'إضافة' : 'خصم';
    const signEmoji  = isAdd ? '➕' : '➖';

    bot.sendMessage(chatId,
      `✅ *تمت عملية ${actionText} الرصيد بنجاح*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 *الاسم:* ${updated.full_name || 'بدون اسم'}\n` +
      `🆔 *الايدي:* \`${updated.unique_id}\`\n` +
      `${signEmoji} *المبلغ:* ${formatUSD(amount)}\n` +
      `💼 *الرصيد الجديد:* ${formatUSD(updated.balance)}\n` +
      `📅 *التاريخ:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });

    bot.sendMessage(updated.telegram_id,
      `💰 *تحديث على رصيدك*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `${signEmoji} *تم ${actionText}:* ${formatUSD(amount)}\n` +
      `💼 *رصيدك الحالي:* ${formatUSD(updated.balance)}\n` +
      `🏦 *الجهة:* الإدارة\n` +
      `📅 *التاريخ:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });

    return;
  }

  // ──────────────────────────────────────────
  // 👤 إضافة وكيل
  // ──────────────────────────────────────────
  if (text === "👤 إضافة وكيل") {
    setSession(chatId, { action: 'add_agent' });
    return bot.sendMessage(chatId,
      "📨 أرسل *Telegram ID* الخاص بالوكيل:\n_(الرقم الرقمي فقط، مثال: 123456789)_",
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'add_agent') {
    const telegram_id = Number(text);
    if (isNaN(telegram_id) || telegram_id <= 0) {
      return bot.sendMessage(chatId, "❌ أرسل رقم Telegram ID صحيح (أرقام فقط)");
    }

    let agent;
    try {
      agent = await createAgent({ telegram_id });
    } catch (e) {
      deleteSession(chatId);
      console.error('Add agent error:', e.message);

      if (e.message === 'ALREADY_EXISTS') {
        return bot.sendMessage(chatId, "⚠️ هذا الشخص موجود بالفعل في النظام");
      }

      // إظهار الخطأ الحقيقي لمساعدتك في التشخيص
      return bot.sendMessage(chatId,
        `❌ *فشل إضافة الوكيل*\n\n` +
        `📋 *تفاصيل الخطأ:*\n\`${e.message}\`\n\n` +
        `🔧 *الحل المحتمل:*\n` +
        `تأكد أنك تستخدم مفتاح \`service_role\` من Supabase وليس \`anon\``,
        { parse_mode: 'Markdown' });
    }

    deleteSession(chatId);

    // إشعار الأدمن
    bot.sendMessage(chatId,
      `✅ *تم إضافة وكيل جديد بنجاح*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📱 *Telegram ID:* \`${telegram_id}\`\n` +
      `🔑 *ايدي الوكيل في اللعبة:* \`${agent.unique_id}\`\n` +
      `📅 *التاريخ:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });

    // إشعار الوكيل
    bot.sendMessage(telegram_id,
      `🎉 *مبروك! تم تعيينك كوكيل في SpinX*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🔑 *ايديك الخاص في اللعبة:* \`${agent.unique_id}\`\n` +
      `📌 *شارك هذا الايدي مع لاعبيك عند التسجيل*\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `استخدم /agent لفتح لوحة التحكم الخاصة بك 🧑‍💼`,
      { parse_mode: 'Markdown' });

    return;
  }

  // ──────────────────────────────────────────
  // ❄️ تجميد حساب
  // ──────────────────────────────────────────
  if (text === "❄️ تجميد حساب") {
    setSession(chatId, { action: 'block_account' });
    return bot.sendMessage(chatId,
      "📨 أرسل *ايدي الحساب* المراد تجميده:",
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'block_account' && !session?.block_target) {
    const user = await getUserByUniqueId(text);
    if (!user) return bot.sendMessage(chatId, "❌ الحساب غير موجود");
    if (user.is_blocked) return bot.sendMessage(chatId, "⚠️ الحساب مجمد بالفعل");

    updateSession(chatId, { block_target: user });

    let agentInfo = '';
    if (user.role === 'player' && user.agent_id) {
      const agent = await getUserById(user.agent_id);
      if (agent) agentInfo = `\n🧑‍💼 *الوكيل:* ${agent.full_name || 'وكيل'} | \`${agent.unique_id}\``;
    }

    return bot.sendMessage(chatId,
      `⚠️ *بيانات الحساب:*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 *الاسم:* ${user.full_name || 'بدون اسم'}\n` +
      `🆔 *الايدي:* \`${user.unique_id}\`\n` +
      `📱 *الهاتف:* ${user.phone || 'غير متوفر'}\n` +
      `💰 *الرصيد:* ${formatUSD(user.balance)}\n` +
      `📋 *النوع:* ${user.role === 'player' ? 'لاعب' : 'وكيل'}${agentInfo}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `⚡ أرسل *نعم* لتأكيد تجميد الحساب:`,
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'block_account' && session?.block_target) {
    if (text !== 'نعم') {
      deleteSession(chatId);
      return bot.sendMessage(chatId, "❎ تم إلغاء عملية التجميد", adminKeyboard());
    }

    const user = session.block_target;
    await blockUser(user.id);
    deleteSession(chatId);

    bot.sendMessage(chatId,
      `❄️ *تم تجميد الحساب بنجاح*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 *الاسم:* ${user.full_name || 'بدون اسم'}\n` +
      `🆔 *الايدي:* \`${user.unique_id}\`\n` +
      `📱 *الهاتف:* ${user.phone || 'غير متوفر'}\n` +
      `💰 *الرصيد:* ${formatUSD(user.balance)}\n` +
      `📅 *التاريخ:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });

    bot.sendMessage(user.telegram_id,
      `❄️ *تم تجميد حسابك*\n\nالرجاء التواصل مع الإدارة\n@SpinXAdmin`,
      { parse_mode: 'Markdown' });
    return;
  }

  // ──────────────────────────────────────────
  // 🔓 فك التجميد
  // ──────────────────────────────────────────
  if (text === "🔓 فك التجميد") {
    setSession(chatId, { action: 'unblock_account' });
    return bot.sendMessage(chatId,
      "📨 أرسل *ايدي الحساب* المراد فك تجميده:",
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'unblock_account' && !session?.unblock_target) {
    const user = await getUserByUniqueId(text);
    if (!user) return bot.sendMessage(chatId, "❌ الحساب غير موجود");
    if (!user.is_blocked) return bot.sendMessage(chatId, "⚠️ الحساب غير مجمد أصلاً");

    updateSession(chatId, { unblock_target: user });

    return bot.sendMessage(chatId,
      `🔍 *بيانات الحساب المجمد:*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 *الاسم:* ${user.full_name || 'بدون اسم'}\n` +
      `🆔 *الايدي:* \`${user.unique_id}\`\n` +
      `💰 *الرصيد:* ${formatUSD(user.balance)}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `✅ أرسل *نعم* لتأكيد فك التجميد:`,
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'unblock_account' && session?.unblock_target) {
    if (text !== 'نعم') {
      deleteSession(chatId);
      return bot.sendMessage(chatId, "❎ تم إلغاء العملية", adminKeyboard());
    }

    const user = session.unblock_target;
    await unblockUser(user.id);
    deleteSession(chatId);

    bot.sendMessage(chatId,
      `🔓 *تم فك تجميد الحساب بنجاح*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 *الاسم:* ${user.full_name || 'بدون اسم'}\n` +
      `🆔 *الايدي:* \`${user.unique_id}\`\n` +
      `💰 *الرصيد:* ${formatUSD(user.balance)}\n` +
      `📅 *التاريخ:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });

    bot.sendMessage(user.telegram_id,
      `🔓 *تم فك تجميد حسابك*\n\nيمكنك الآن استخدام البوت بشكل طبيعي 🎮`,
      { parse_mode: 'Markdown' });
    return;
  }

  // ──────────────────────────────────────────
  // 📢 إشعار للجميع
  // ──────────────────────────────────────────
  if (text === "📢 إشعار للجميع") {
    setSession(chatId, { action: 'broadcast' });
    return bot.sendMessage(chatId,
      "📢 *أرسل الرسالة التي تريد إذاعتها للجميع:*",
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'broadcast') {
    const message = text;
    deleteSession(chatId);

    const allUsers = await getAllUsers();
    let sent = 0, failed = 0;

    const broadcastMsg =
      `📢 *إشعار من إدارة SpinX*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `${message}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📅 ${formatDate()}`;

    for (const u of allUsers) {
      try {
        await bot.sendMessage(u.telegram_id, broadcastMsg, { parse_mode: 'Markdown' });
        sent++;
      } catch (_) { failed++; }
    }

    await bot.sendMessage(chatId, broadcastMsg, { parse_mode: 'Markdown' });

    return bot.sendMessage(chatId,
      `✅ *تم إرسال الإشعار*\n📤 *مرسل:* ${sent} | ❌ *فشل:* ${failed}`,
      { parse_mode: 'Markdown' });
  }

  // ──────────────────────────────────────────
  // ✉️ رسالة خاصة
  // ──────────────────────────────────────────
  if (text === "✉️ رسالة خاصة") {
    setSession(chatId, { action: 'private_msg' });
    return bot.sendMessage(chatId,
      "📨 أرسل *ايدي الحساب* الذي تريد مراسلته:",
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'private_msg' && !session?.msg_target) {
    const user = await getUserByUniqueId(text);
    if (!user) return bot.sendMessage(chatId, "❌ الحساب غير موجود");

    updateSession(chatId, { msg_target: user });

    return bot.sendMessage(chatId,
      `✅ *الحساب:* ${user.full_name || 'بدون اسم'} | \`${user.unique_id}\`\n\n✍️ أرسل الرسالة الخاصة:`,
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'private_msg' && session?.msg_target) {
    const target = session.msg_target;
    deleteSession(chatId);

    const privateMsg =
      `📩 *رسالة خاصة من إدارة SpinX*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `${text}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📅 ${formatDate()}`;

    bot.sendMessage(target.telegram_id, privateMsg, { parse_mode: 'Markdown' });
    bot.sendMessage(chatId,
      `✅ *تم إرسال الرسالة إلى:* ${target.full_name || 'بدون اسم'}\n\n` + privateMsg,
      { parse_mode: 'Markdown' });
    return;
  }

  // ──────────────────────────────────────────
  // 🎯 ضربة حظ
  // ──────────────────────────────────────────
  if (text === "🎯 ضربة حظ") {
    setSession(chatId, { action: 'luck_win' });
    return bot.sendMessage(chatId,
      "🎯 أرسل *ايدي اللاعب* لتفعيل ضربة الحظ:",
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'luck_win' && !session?.luck_target) {
    const user = await getUserByUniqueId(text);
    if (!user || user.role !== 'player') {
      return bot.sendMessage(chatId, "❌ اللاعب غير موجود");
    }
    updateSession(chatId, { luck_target: user });
    return bot.sendMessage(chatId,
      `✅ *اللاعب:* ${user.full_name} | \`${user.unique_id}\`\n` +
      `💰 *رصيده:* ${formatUSD(user.balance)}\n\n` +
      `💰 أرسل *المبلغ المستهدف* لضربة الحظ:`,
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'luck_win' && session?.luck_target) {
    const amount = Number(text);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, "❌ مبلغ غير صحيح");

    await setLuckControl(session.luck_target.id, 'win', amount);
    deleteSession(chatId);

    return bot.sendMessage(chatId,
      `🎯 *تم تفعيل ضربة الحظ*\n\n` +
      `👤 *اللاعب:* ${session.luck_target.full_name}\n` +
      `💰 *مبلغ الهدف:* ${formatUSD(amount)}\n` +
      `📅 *التاريخ:* ${formatDate()}`,
      { parse_mode: 'Markdown' });
  }

  // ──────────────────────────────────────────
  // 💀 حظ أوفر
  // ──────────────────────────────────────────
  if (text === "💀 حظ أوفر") {
    setSession(chatId, { action: 'luck_lose' });
    return bot.sendMessage(chatId,
      "💀 أرسل *ايدي اللاعب* لتفعيل حظ أوفر:",
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'luck_lose' && !session?.luck_target) {
    const user = await getUserByUniqueId(text);
    if (!user || user.role !== 'player') {
      return bot.sendMessage(chatId, "❌ اللاعب غير موجود");
    }
    updateSession(chatId, { luck_target: user });
    return bot.sendMessage(chatId,
      `✅ *اللاعب:* ${user.full_name} | \`${user.unique_id}\`\n` +
      `💰 *رصيده:* ${formatUSD(user.balance)}\n\n` +
      `💸 أرسل *المبلغ المستهدف* للخسارة:`,
      { parse_mode: 'Markdown' });
  }

  if (session?.action === 'luck_lose' && session?.luck_target) {
    const amount = Number(text);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, "❌ مبلغ غير صحيح");

    await setLuckControl(session.luck_target.id, 'lose', amount);
    deleteSession(chatId);

    return bot.sendMessage(chatId,
      `💀 *تم تفعيل حظ أوفر*\n\n` +
      `👤 *اللاعب:* ${session.luck_target.full_name}\n` +
      `💸 *مبلغ الخسارة المستهدف:* ${formatUSD(amount)}\n` +
      `📅 *التاريخ:* ${formatDate()}`,
      { parse_mode: 'Markdown' });
  }

  // ──────────────────────────────────────────
  // 📊 الإحصائيات
  // ──────────────────────────────────────────
  if (text === "📊 الإحصائيات") {
    const players = await getAllPlayers();
    const agents  = await getAllAgents();

    const totalPlayerBalance = players.reduce((s, p) => s + Number(p.balance), 0);
    const totalAgentBalance  = agents.reduce((s, a) => s + Number(a.balance), 0);
    const activePlayers      = players.filter(p => !p.is_blocked).length;

    return bot.sendMessage(chatId,
      `📊 *إحصائيات SpinX*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🎮 *عدد اللاعبين:* ${players.length}\n` +
      `🧑‍💼 *عدد الوكلاء:* ${agents.length}\n` +
      `🟢 *اللاعبون النشطون:* ${activePlayers}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 *إجمالي رصيد اللاعبين:* ${formatUSD(totalPlayerBalance)}\n` +
      `💼 *إجمالي رصيد الوكلاء:* ${formatUSD(totalAgentBalance)}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📅 *التاريخ:* ${formatDate()}`,
      { parse_mode: 'Markdown' });
  }
});
