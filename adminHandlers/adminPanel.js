const { bot, ADMIN_ID } = require('../config/config');
const { supabase } = require('../config/config');
const {
  getUserByUniqueId, getUserByTelegramId, getUserById,
  updateBalance, createAgent, blockUser, unblockUser, getStats
} = require('../services/userService');
const { formatUSD, formatDate } = require('../utils/helpers');
const { adminKeyboard, chooseTypeKeyboard } = require('../keyboards/mainKeyboard');

const adminSessions = {};

bot.onText(/\/admin/, (msg) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  bot.sendMessage(msg.chat.id, '👑 *لوحة تحكم الأدمن - SpinX*', { parse_mode: 'Markdown', ...adminKeyboard() });
});

bot.on('message', async (msg) => {
  if (!msg.text || msg.from.id.toString() !== ADMIN_ID) return;
  const chatId = msg.chat.id;
  const text = msg.text;
  const session = adminSessions[chatId];

  // ➕ إضافة رصيد
  if (text === '➕ إضافة رصيد') {
    adminSessions[chatId] = { action: 'add_balance' };
    return bot.sendMessage(chatId, '➕ *إضافة رصيد*\n\nاختر نوع الحساب:', { parse_mode: 'Markdown', ...chooseTypeKeyboard('add_bal') });
  }

  // ➖ خصم رصيد
  if (text === '➖ خصم رصيد') {
    adminSessions[chatId] = { action: 'deduct_balance' };
    return bot.sendMessage(chatId, '➖ *خصم رصيد*\n\nاختر نوع الحساب:', { parse_mode: 'Markdown', ...chooseTypeKeyboard('deduct_bal') });
  }

  // إدخال ايدي الحساب
  if ((session?.action === 'add_balance' || session?.action === 'deduct_balance') && session?.type && !session?.user) {
    const account = await getUserByUniqueId(text.trim());
    if (!account) return bot.sendMessage(chatId, '❌ الحساب غير موجود، تحقق من الايدي');
    const expectedRole = session.type === 'player' ? 'player' : 'agent';
    if (account.role !== expectedRole) return bot.sendMessage(chatId, `❌ هذا الايدي ليس ${session.type === 'player' ? 'لاعباً' : 'وكيلاً'}`);
    session.user = account;
    const agentInfo = account.role === 'player' && account.agent_id ? await getUserById(account.agent_id) : null;
    return bot.sendMessage(chatId,
      `✅ *تم العثور على الحساب*\n\n━━━━━━━━━━━━━━━━━\n👤 الاسم: ${account.full_name || 'غير محدد'}\n🆔 الايدي: \`${account.unique_id}\`\n💰 الرصيد الحالي: ${formatUSD(account.balance)}\n${agentInfo ? `🧑‍💼 الوكيل: ${agentInfo.full_name || 'غير محدد'} (\`${agentInfo.unique_id}\`)` : ''}\n━━━━━━━━━━━━━━━━━\n💸 أرسل المبلغ:`,
      { parse_mode: 'Markdown' }
    );
  }

  // إدخال المبلغ
  if ((session?.action === 'add_balance' || session?.action === 'deduct_balance') && session?.user) {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, '❌ أرسل مبلغاً صحيحاً');
    const isAdd = session.action === 'add_balance';
    const targetUser = session.user;
    delete adminSessions[chatId];
    try {
      if (!isAdd && Number(targetUser.balance) < amount) {
        return bot.sendMessage(chatId, `❌ رصيد الحساب لا يكفي للخصم\n💰 رصيده الحالي: ${formatUSD(targetUser.balance)}`);
      }
      const updated = await updateBalance(targetUser.id, isAdd ? amount : -amount);
      const now = formatDate();
      const icon = isAdd ? '➕' : '➖';
      const actionAr = isAdd ? 'إضافة' : 'خصم';

      bot.sendMessage(chatId,
        `✅ *تمت عملية ${actionAr} الرصيد بنجاح!*\n\n━━━━━━━━━━━━━━━━━\n👤 الاسم: ${updated.full_name}\n🆔 الايدي: \`${updated.unique_id}\`\n${icon} المبلغ: ${formatUSD(amount)}\n💼 الرصيد الجديد: ${formatUSD(updated.balance)}\n⏰ ${now}\n━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
      bot.sendMessage(updated.telegram_id,
        `💰 *تحديث على رصيدك!*\n\n━━━━━━━━━━━━━━━━━\n${icon} ${isAdd ? 'تمت إضافة' : 'تم خصم'} ${formatUSD(amount)} ${isAdd ? 'لحسابك' : 'من حسابك'}\n💼 رصيدك الحالي: ${formatUSD(updated.balance)}\n🏛️ الجهة المرسلة: الإدارة\n⏰ ${now}\n━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) { bot.sendMessage(chatId, '❌ حدث خطأ في العملية'); }
    return;
  }

  // 👤 إضافة وكيل
  if (text === '👤 إضافة وكيل') {
    adminSessions[chatId] = { action: 'add_agent' };
    return bot.sendMessage(chatId, `👤 *إضافة وكيل جديد*\n\n📨 أرسل Telegram ID الخاص بالوكيل\n_(رقم مثل: 123456789)_`, { parse_mode: 'Markdown' });
  }

  if (session?.action === 'add_agent') {
    const telegramId = parseInt(text.trim());
    if (isNaN(telegramId)) return bot.sendMessage(chatId, '❌ الرجاء إرسال Telegram ID صحيح (أرقام فقط)');
    delete adminSessions[chatId];
    try {
      const existing = await getUserByTelegramId(telegramId);
      if (existing) return bot.sendMessage(chatId, `❌ هذا الحساب موجود بالفعل بدور: ${existing.role}\n🆔 ايديه: \`${existing.unique_id}\``, { parse_mode: 'Markdown' });
      const agent = await createAgent({ telegram_id: telegramId, full_name: 'وكيل SpinX' });
      const now = formatDate();
      bot.sendMessage(chatId,
        `✅ *تم إضافة وكيل جديد بنجاح!*\n\n━━━━━━━━━━━━━━━━━\n🆔 ايدي الوكيل: \`${agent.unique_id}\`\n📲 Telegram ID: \`${telegramId}\`\n⏰ ${now}\n━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
      bot.sendMessage(telegramId,
        `🎉 *مرحباً! تم تعيينك وكيلاً في SpinX!*\n\n━━━━━━━━━━━━━━━━━\n🧑‍💼 أصبحت الآن وكيلاً معتمداً في لعبة SpinX\n🆔 ايديك الخاص: \`${agent.unique_id}\`\n━━━━━━━━━━━━━━━━━\n💼 يمكنك الآن:\n• استقبال اللاعبين\n• تحويل الرصيد للاعبين\n• طلب رصيد من الإدارة\n\nأرسل /agent لفتح لوحة تحكمك 🎮`,
        { parse_mode: 'Markdown' }
      ).catch(() => bot.sendMessage(chatId, `⚠️ تم إنشاء الحساب لكن لم يتمكن البوت من إرسال إشعار للوكيل\nربما لم يبدأ المحادثة مع البوت بعد`));
    } catch (err) { bot.sendMessage(chatId, `❌ خطأ: ${err.message}`); }
    return;
  }

  // ❄️ تجميد حساب
  if (text === '❄️ تجميد حساب') {
    adminSessions[chatId] = { action: 'block' };
    return bot.sendMessage(chatId, '❄️ *تجميد حساب*\n\n📨 أرسل ايدي الحساب (6 أرقام):', { parse_mode: 'Markdown' });
  }

  if (session?.action === 'block' && !session?.target) {
    const account = await getUserByUniqueId(text.trim());
    if (!account) return bot.sendMessage(chatId, '❌ الحساب غير موجود');
    session.target = account;
    const agentInfo = account.role === 'player' && account.agent_id ? await getUserById(account.agent_id) : null;
    return bot.sendMessage(chatId,
      `❄️ *تأكيد تجميد الحساب*\n\n━━━━━━━━━━━━━━━━━\n👤 الاسم: ${account.full_name || 'غير محدد'}\n🆔 الايدي: \`${account.unique_id}\`\n📞 الهاتف: ${account.phone || 'غير محدد'}\n💰 الرصيد: ${formatUSD(account.balance)}\n${agentInfo ? `🧑‍💼 الوكيل: ${agentInfo.full_name}` : ''}\n━━━━━━━━━━━━━━━━━\n⚠️ أرسل *نعم* لتأكيد التجميد:`,
      { parse_mode: 'Markdown' }
    );
  }

  if (session?.action === 'block' && session?.target) {
    if (text !== 'نعم') { delete adminSessions[chatId]; return bot.sendMessage(chatId, '❌ تم إلغاء عملية التجميد', adminKeyboard()); }
    const account = session.target;
    delete adminSessions[chatId];
    try {
      await blockUser(account.id);
      const now = formatDate();
      bot.sendMessage(chatId,
        `✅ *تم تجميد الحساب بنجاح!*\n\n━━━━━━━━━━━━━━━━━\n👤 الاسم: ${account.full_name}\n🆔 الايدي: \`${account.unique_id}\`\n📞 الهاتف: ${account.phone || 'غير محدد'}\n💰 الرصيد: ${formatUSD(account.balance)}\n⏰ ${now}\n━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
      bot.sendMessage(account.telegram_id,
        `🚫 *تم تجميد حسابك!*\n\n━━━━━━━━━━━━━━━━━\nحسابك في مرحلة التجميد حالياً\nالرجاء التواصل مع الإدارة لمعرفة السبب\n📞 @SpinXAdmin\n━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) { bot.sendMessage(chatId, '❌ حدث خطأ في التجميد'); }
    return;
  }

  // 🔓 فك التجميد
  if (text === '🔓 فك التجميد') {
    adminSessions[chatId] = { action: 'unblock' };
    return bot.sendMessage(chatId, '🔓 *فك التجميد*\n\n📨 أرسل ايدي الحساب (6 أرقام):', { parse_mode: 'Markdown' });
  }

  if (session?.action === 'unblock' && !session?.target) {
    const account = await getUserByUniqueId(text.trim());
    if (!account) return bot.sendMessage(chatId, '❌ الحساب غير موجود');
    if (!account.is_blocked) { delete adminSessions[chatId]; return bot.sendMessage(chatId, '⚠️ هذا الحساب غير مجمّد أصلاً'); }
    session.target = account;
    return bot.sendMessage(chatId,
      `🔓 *تأكيد فك التجميد*\n\n━━━━━━━━━━━━━━━━━\n👤 الاسم: ${account.full_name || 'غير محدد'}\n🆔 الايدي: \`${account.unique_id}\`\n💰 الرصيد: ${formatUSD(account.balance)}\n━━━━━━━━━━━━━━━━━\n⚠️ أرسل *نعم* لتأكيد فك التجميد:`,
      { parse_mode: 'Markdown' }
    );
  }

  if (session?.action === 'unblock' && session?.target) {
    if (text !== 'نعم') { delete adminSessions[chatId]; return bot.sendMessage(chatId, '❌ تم إلغاء عملية فك التجميد', adminKeyboard()); }
    const account = session.target;
    delete adminSessions[chatId];
    try {
      await unblockUser(account.id);
      const now = formatDate();
      bot.sendMessage(chatId,
        `✅ *تم فك التجميد بنجاح!*\n\n━━━━━━━━━━━━━━━━━\n👤 الاسم: ${account.full_name}\n🆔 الايدي: \`${account.unique_id}\`\n💰 الرصيد: ${formatUSD(account.balance)}\n⏰ ${now}\n━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
      bot.sendMessage(account.telegram_id,
        `✅ *تم فك تجميد حسابك!*\n\n━━━━━━━━━━━━━━━━━\nحسابك نشط الآن ويمكنك استخدام البوت بشكل طبيعي\n⏰ ${now}\n━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) { bot.sendMessage(chatId, '❌ حدث خطأ في فك التجميد'); }
    return;
  }

  // 📢 إشعار للجميع
  if (text === '📢 إشعار للجميع') {
    adminSessions[chatId] = { action: 'broadcast' };
    return bot.sendMessage(chatId, '📢 *إشعار للجميع*\n\n✍️ أرسل الرسالة التي تريد إرسالها لجميع المستخدمين:', { parse_mode: 'Markdown' });
  }

  if (session?.action === 'broadcast') {
    const message = text;
    delete adminSessions[chatId];
    try {
      const { data: allUsers } = await supabase.from('users').select('telegram_id').in('role', ['player', 'agent']);
      const broadcastMsg = `📢 *إشعار من إدارة SpinX*\n\n━━━━━━━━━━━━━━━━━\n${message}\n━━━━━━━━━━━━━━━━━\n⏰ ${formatDate()}`;
      let sent = 0, failed = 0;
      for (const u of allUsers || []) {
        try { await bot.sendMessage(u.telegram_id, broadcastMsg, { parse_mode: 'Markdown' }); sent++; }
        catch (e) { failed++; }
        await new Promise(r => setTimeout(r, 50));
      }
      // إشعار الأدمن أيضاً
      bot.sendMessage(chatId, broadcastMsg, { parse_mode: 'Markdown' });
      bot.sendMessage(chatId, `✅ *تم إرسال الإشعار*\n\n✅ تم الإرسال: ${sent}\n❌ فشل: ${failed}\n⏰ ${formatDate()}`, { parse_mode: 'Markdown' });
    } catch (err) { bot.sendMessage(chatId, '❌ حدث خطأ أثناء الإرسال'); }
    return;
  }

  // ✉️ رسالة خاصة
  if (text === '✉️ رسالة خاصة') {
    adminSessions[chatId] = { action: 'private_msg' };
    return bot.sendMessage(chatId, '✉️ *رسالة خاصة*\n\n📨 أرسل ايدي الحساب (6 أرقام):', { parse_mode: 'Markdown' });
  }

  if (session?.action === 'private_msg' && !session?.target) {
    const account = await getUserByUniqueId(text.trim());
    if (!account) return bot.sendMessage(chatId, '❌ الحساب غير موجود');
    session.target = account;
    return bot.sendMessage(chatId,
      `✅ *تم العثور على الحساب*\n\n━━━━━━━━━━━━━━━━━\n👤 الاسم: ${account.full_name}\n🆔 الايدي: \`${account.unique_id}\`\n💰 الرصيد: ${formatUSD(account.balance)}\n━━━━━━━━━━━━━━━━━\n✍️ أرسل الرسالة التي تريد إيصالها:`,
      { parse_mode: 'Markdown' }
    );
  }

  if (session?.action === 'private_msg' && session?.target) {
    const account = session.target;
    delete adminSessions[chatId];
    const now = formatDate();
    const privateMsg = `📩 *رسالة خاصة من إدارة SpinX*\n\n━━━━━━━━━━━━━━━━━\n${text}\n━━━━━━━━━━━━━━━━━\n⏰ ${now}`;
    try {
      await bot.sendMessage(account.telegram_id, privateMsg, { parse_mode: 'Markdown' });
      bot.sendMessage(chatId, `✅ *تم إرسال الرسالة بنجاح*\n\n👤 إلى: ${account.full_name}\n⏰ ${now}`, { parse_mode: 'Markdown' });
    } catch (err) { bot.sendMessage(chatId, '❌ فشل إرسال الرسالة، تحقق من أن المستخدم بدأ المحادثة مع البوت'); }
    return;
  }

  // 🎯 ضربة حظ
  if (text === '🎯 ضربة حظ') {
    adminSessions[chatId] = { action: 'luck_win' };
    return bot.sendMessage(chatId, '🎯 *ضربة الحظ*\n\n📨 أرسل ايدي اللاعب (6 أرقام):', { parse_mode: 'Markdown' });
  }

  if (session?.action === 'luck_win' && !session?.target) {
    const player = await getUserByUniqueId(text.trim());
    if (!player || player.role !== 'player') return bot.sendMessage(chatId, '❌ اللاعب غير موجود');
    session.target = player;
    return bot.sendMessage(chatId,
      `✅ *اللاعب موجود*\n\n━━━━━━━━━━━━━━━━━\n👤 ${player.full_name}\n🆔 \`${player.unique_id}\`\n💰 رصيده: ${formatUSD(player.balance)}\n━━━━━━━━━━━━━━━━━\n💸 أرسل حد مبلغ الفوز (مثال: 100):`,
      { parse_mode: 'Markdown' }
    );
  }

  if (session?.action === 'luck_win' && session?.target) {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, '❌ أرسل مبلغاً صحيحاً');
    const player = session.target;
    delete adminSessions[chatId];
    try {
      await supabase.from('luck_control').delete().eq('user_id', player.id);
      await supabase.from('luck_control').insert([{ user_id: player.id, type: 'win', amount, used_amount: 0 }]);
      bot.sendMessage(chatId,
        `✅ *تم تفعيل ضربة الحظ*\n\n━━━━━━━━━━━━━━━━━\n👤 اللاعب: ${player.full_name}\n🆔 \`${player.unique_id}\`\n🎯 حد الفوز: ${formatUSD(amount)}\n⏰ ${formatDate()}\n━━━━━━━━━━━━━━━━━\n🎰 اللاعب سيفوز حتى يصل لهذا المبلغ`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) { bot.sendMessage(chatId, '❌ حدث خطأ في التفعيل'); }
    return;
  }

  // 💀 حظ أوفر
  if (text === '💀 حظ أوفر') {
    adminSessions[chatId] = { action: 'luck_lose' };
    return bot.sendMessage(chatId, '💀 *حظ أوفر*\n\n📨 أرسل ايدي اللاعب (6 أرقام):', { parse_mode: 'Markdown' });
  }

  if (session?.action === 'luck_lose' && !session?.target) {
    const player = await getUserByUniqueId(text.trim());
    if (!player || player.role !== 'player') return bot.sendMessage(chatId, '❌ اللاعب غير موجود');
    session.target = player;
    return bot.sendMessage(chatId,
      `✅ *اللاعب موجود*\n\n━━━━━━━━━━━━━━━━━\n👤 ${player.full_name}\n🆔 \`${player.unique_id}\`\n💰 رصيده: ${formatUSD(player.balance)}\n━━━━━━━━━━━━━━━━━\n💸 أرسل حد مبلغ الخسارة (مثال: 100):`,
      { parse_mode: 'Markdown' }
    );
  }

  if (session?.action === 'luck_lose' && session?.target) {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, '❌ أرسل مبلغاً صحيحاً');
    const player = session.target;
    delete adminSessions[chatId];
    try {
      await supabase.from('luck_control').delete().eq('user_id', player.id);
      await supabase.from('luck_control').insert([{ user_id: player.id, type: 'lose', amount, used_amount: 0 }]);
      bot.sendMessage(chatId,
        `✅ *تم تفعيل حظ أوفر*\n\n━━━━━━━━━━━━━━━━━\n👤 اللاعب: ${player.full_name}\n🆔 \`${player.unique_id}\`\n💀 حد الخسارة: ${formatUSD(amount)}\n⏰ ${formatDate()}\n━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) { bot.sendMessage(chatId, '❌ حدث خطأ في التفعيل'); }
    return;
  }

  // 📊 الإحصائيات
  if (text === '📊 الإحصائيات') {
    try {
      const stats = await getStats();
      bot.sendMessage(chatId,
        `📊 *إحصائيات SpinX*\n\n━━━━━━━━━━━━━━━━━\n👥 عدد اللاعبين: *${stats.playerCount}*\n🧑‍💼 عدد الوكلاء: *${stats.agentCount}*\n━━━━━━━━━━━━━━━━━\n💰 إجمالي أرصدة اللاعبين: ${formatUSD(stats.totalPlayerBalance)}\n💼 إجمالي أرصدة الوكلاء: ${formatUSD(stats.totalAgentBalance)}\n💵 إجمالي الأرصدة في النظام: ${formatUSD(stats.totalPlayerBalance + stats.totalAgentBalance)}\n━━━━━━━━━━━━━━━━━\n⏰ ${formatDate()}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) { bot.sendMessage(chatId, '❌ حدث خطأ في جلب الإحصائيات'); }
    return;
  }
});

bot.on('callback_query', async (query) => {
  if (query.from.id.toString() !== ADMIN_ID) return;
  const data = query.data;
  const chatId = query.message.chat.id;

  if (data === 'add_bal_player' || data === 'add_bal_agent') {
    await bot.answerCallbackQuery(query.id);
    adminSessions[chatId] = { action: 'add_balance', type: data === 'add_bal_player' ? 'player' : 'agent' };
    return bot.editMessageText(
      `➕ *إضافة رصيد لـ ${data === 'add_bal_player' ? 'لاعب' : 'وكيل'}*\n\n📨 أرسل ايدي الحساب (6 أرقام):`,
      { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
    );
  }

  if (data === 'deduct_bal_player' || data === 'deduct_bal_agent') {
    await bot.answerCallbackQuery(query.id);
    adminSessions[chatId] = { action: 'deduct_balance', type: data === 'deduct_bal_player' ? 'player' : 'agent' };
    return bot.editMessageText(
      `➖ *خصم رصيد من ${data === 'deduct_bal_player' ? 'لاعب' : 'وكيل'}*\n\n📨 أرسل ايدي الحساب (6 أرقام):`,
      { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
    );
  }
});
