// handlers/registerHandler.js
const { bot, ADMIN_ID }       = require('../config/config');
const { getUserByTelegramId, getUserByUniqueId, createPlayer, getUserById } = require('../services/userService');
const { startRegisterKeyboard, phoneKeyboard, removeKeyboard, playerKeyboard } = require('../keyboards/mainKeyboard');
const { formatUSD, formatDate } = require('../utils/helpers');
const { getSession, setSession, deleteSession, updateSession } = require('../state/sessions');

// ▶️ /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const existing = await getUserByTelegramId(chatId);

  if (existing) {
    if (existing.is_blocked) {
      return bot.sendMessage(chatId, "🚫 حسابك في مرحلة التجميد\nالرجاء التواصل مع الإدارة");
    }
    return bot.sendMessage(chatId, "✅ أنت مسجل بالفعل في SpinX\nاستخدم الأزرار أدناه للتنقل", playerKeyboard());
  }

  bot.sendMessage(
    chatId,
    `🎰 *مرحباً بك في SpinX*\n\n` +
    `🌟 *وصف اللعبة:*\n` +
    `نظام مراهنات رقمي مثير يعمل عبر تيليغرام يتيح لك المشاركة في رهانات باستخدام الدولار الأمريكي 💵\n\n` +
    `🏗️ *هيكل النظام:*\n` +
    `👑 الإدارة — إشراف كامل على النظام\n` +
    `🧑‍💼 الوكلاء — إدارة الإيداع والسحب\n` +
    `🎮 اللاعبون — المشاركة في الرهانات\n\n` +
    `📜 *القواعد العامة:*\n` +
    `• تقديم معلومات صحيحة أثناء التسجيل\n` +
    `• يُمنع إنشاء أكثر من حساب\n` +
    `• جميع العمليات المالية عبر الوكيل فقط\n` +
    `• أي محاولة احتيال تؤدي لإيقاف الحساب فورًا\n\n` +
    `⚖️ *بالضغط على زر التسجيل أنت توافق على جميع الشروط*\n\n` +
    `👇 اضغط للبدء`,
    { parse_mode: 'Markdown', ...startRegisterKeyboard() }
  );
});

// 🎯 callback: زر بدء التسجيل
bot.on('callback_query', async (query) => {
  if (query.data !== 'start_register') return;
  const chatId = query.message.chat.id;

  const existing = await getUserByTelegramId(chatId);
  if (existing) {
    return bot.answerCallbackQuery(query.id, { text: '✅ أنت مسجل بالفعل' });
  }

  setSession(chatId, { step: 'register_agent' });
  bot.answerCallbackQuery(query.id);
  bot.sendMessage(chatId, "📨 الرجاء أرسل *ايدي الوكيل* المسؤول عن حسابك:", { parse_mode: 'Markdown' });
});

// 📩 رسائل التسجيل
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);

  // تجاهل إن لم يكن في جلسة تسجيل
  if (!session || !session.step || !session.step.startsWith('register_')) return;

  // 1️⃣ إدخال ID الوكيل
  if (session.step === 'register_agent') {
    if (!msg.text) return;
    const agent = await getUserByUniqueId(msg.text.trim());

    if (!agent || agent.role !== 'agent') {
      return bot.sendMessage(chatId,
        "❌ *هذا الايدي غير موجود*\nالرجاء التحقق من الوكيل ليمنحك الايدي الصحيح الخاص بحسابه",
        { parse_mode: 'Markdown' });
    }

    updateSession(chatId, { step: 'register_name', agent });
    return bot.sendMessage(chatId,
      `✅ *الوكيل موجود:* ${agent.full_name || 'وكيل SpinX'}\n\n✍️ الرجاء أرسل *اسمك الكامل*:`,
      { parse_mode: 'Markdown' });
  }

  // 2️⃣ إدخال الاسم
  if (session.step === 'register_name') {
    if (!msg.text) return;
    updateSession(chatId, { step: 'register_phone', full_name: msg.text.trim() });
    return bot.sendMessage(chatId,
      "📱 الرجاء *شارك رقم هاتفك* من زر المشاركة أدناه:",
      { parse_mode: 'Markdown', ...phoneKeyboard() });
  }

  // 3️⃣ استقبال رقم الهاتف
  if (session.step === 'register_phone' && msg.contact) {
    const phone = msg.contact.phone_number;
    const { agent, full_name } = session;

    let newUser;
    try {
      newUser = await createPlayer({
        telegram_id: chatId,
        full_name,
        phone,
        agent_id: agent.id
      });
    } catch (e) {
      deleteSession(chatId);
      return bot.sendMessage(chatId, "❌ حدث خطأ أثناء التسجيل، حاول مرة أخرى لاحقاً");
    }

    deleteSession(chatId);

    // 🎉 إشعار اللاعب
    bot.sendMessage(chatId,
      `🎉 *تم تسجيلك بنجاح في SpinX!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 *الاسم:* ${newUser.full_name}\n` +
      `🆔 *ايديك:* \`${newUser.unique_id}\`\n` +
      `🧑‍💼 *الوكيل:* ${agent.full_name || 'وكيل SpinX'} | \`${agent.unique_id}\`\n` +
      `💰 *رصيدك الحالي:* ${formatUSD(0)}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🔥 استعد للعب واربح!`,
      { parse_mode: 'Markdown', ...playerKeyboard() });

    // 👑 إشعار الأدمن
    bot.sendMessage(ADMIN_ID,
      `🚨 *لاعب جديد انضم إلى SpinX!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 *الاسم:* ${newUser.full_name}\n` +
      `📞 *رقم الهاتف:* ${phone}\n` +
      `🆔 *ايدي اللاعب:* \`${newUser.unique_id}\`\n` +
      `🧑‍💼 *الوكيل:* ${agent.full_name || 'وكيل SpinX'} | \`${agent.unique_id}\`\n` +
      `📅 *تاريخ التسجيل:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });

    // 🧑‍💼 إشعار الوكيل
    bot.sendMessage(agent.telegram_id,
      `🎊 *لاعب جديد انضم إلى فريقك!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 *الاسم:* ${newUser.full_name}\n` +
      `🆔 *ايدي اللاعب:* \`${newUser.unique_id}\`\n` +
      `📅 *تاريخ الانضمام:* ${formatDate()}\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown' });
  }
});
