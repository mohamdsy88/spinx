// handlers/registerHandler.js
const { bot } = require('../config/config');
const { getUserByTelegramId, createPlayer, getUserByUniqueId } = require('../services/userService');
const { phoneKeyboard, removeKeyboard, playerKeyboard, agentKeyboard } = require('../keyboards/mainKeyboard');
const { getSession, setSession, deleteSession, updateSession } = require('../state/sessions');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  callback_query — بدء التسجيل
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
bot.on('callback_query', async (query) => {
  if (query.data !== 'start_register') return;

  const chatId     = query.message.chat.id;
  const telegramId = query.from.id;

  bot.answerCallbackQuery(query.id);

  // التحقق أنه ليس وكيلاً أو لاعباً مسجلاً
  const existing = await getUserByTelegramId(telegramId);
  if (existing) {
    if (existing.role === 'agent') {
      return bot.sendMessage(chatId,
        `🧑‍💼 *أنت وكيل معتمد بالفعل!*\n\n🔑 *ايديك:* \`${existing.unique_id}\``,
        { parse_mode: 'Markdown', ...agentKeyboard() });
    }
    if (existing.role === 'player') {
      return bot.sendMessage(chatId,
        `✅ *أنت مسجل بالفعل!*\n\n🆔 *ايديك:* \`${existing.unique_id}\``,
        { parse_mode: 'Markdown', ...playerKeyboard() });
    }
  }

  setSession(chatId, { action: 'register_agent_id' });

  return bot.sendMessage(chatId,
    `📋 *خطوات التسجيل في SpinX*\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `الخطوة 1️⃣ من 3️⃣\n\n` +
    `🔑 *أرسل ايدي الوكيل الخاص بك:*\n` +
    `_(احصل عليه من وكيلك)_`,
    { parse_mode: 'Markdown', ...removeKeyboard() });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  رسائل التسجيل
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
bot.on('message', async (msg) => {
  const chatId     = msg.chat.id;
  const telegramId = msg.from.id;
  const session    = getSession(chatId);

  // فقط جلسات التسجيل
  if (!session || !session.action?.startsWith('register_')) return;

  const text = msg.text?.trim();

  // ──────────────────────────────────────────
  // الخطوة 1: استقبال ايدي الوكيل
  // ──────────────────────────────────────────
  if (session.action === 'register_agent_id') {
    if (!text) return;

    const agent = await getUserByUniqueId(text);
    if (!agent || agent.role !== 'agent') {
      return bot.sendMessage(chatId,
        `❌ *ايدي الوكيل غير صحيح*\n\n` +
        `تأكد من الايدي وأرسله مرة أخرى:\n` +
        `_(مثال: AB1234)_`,
        { parse_mode: 'Markdown' });
    }

    updateSession(chatId, {
      action:   'register_name',
      agent_id: agent.id
    });

    return bot.sendMessage(chatId,
      `✅ *تم التحقق من الوكيل بنجاح!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `الخطوة 2️⃣ من 3️⃣\n\n` +
      `👤 *أرسل اسمك الكامل:*`,
      { parse_mode: 'Markdown' });
  }

  // ──────────────────────────────────────────
  // الخطوة 2: استقبال الاسم الكامل
  // ──────────────────────────────────────────
  if (session.action === 'register_name') {
    if (!text || text.length < 3) {
      return bot.sendMessage(chatId,
        "❌ الاسم قصير جداً، أرسل اسمك الكامل (3 أحرف على الأقل)");
    }

    updateSession(chatId, {
      action:    'register_phone',
      full_name: text
    });

    return bot.sendMessage(chatId,
      `✅ *تم حفظ الاسم!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `الخطوة 3️⃣ من 3️⃣\n\n` +
      `📱 *اضغط الزر لمشاركة رقم هاتفك:*`,
      { parse_mode: 'Markdown', ...phoneKeyboard() });
  }

  // ──────────────────────────────────────────
  // الخطوة 3: استقبال رقم الهاتف
  // ──────────────────────────────────────────
  if (session.action === 'register_phone') {
    // استقبال جهة الاتصال عبر الزر
    let phone = null;

    if (msg.contact) {
      phone = msg.contact.phone_number;
    } else if (text && /^\+?[0-9]{8,15}$/.test(text.replace(/\s/g, ''))) {
      phone = text;
    } else {
      return bot.sendMessage(chatId,
        "📱 *اضغط على زر مشاركة رقم الهاتف* أو أرسل رقمك يدوياً:\n_(مثال: +9661234567890)_",
        { parse_mode: 'Markdown', ...phoneKeyboard() });
    }

    // التحقق من عدم التسجيل المسبق
    const existing = await getUserByTelegramId(telegramId);
    if (existing) {
      deleteSession(chatId);
      if (existing.role === 'agent') {
        return bot.sendMessage(chatId,
          `🧑‍💼 *أنت وكيل بالفعل!*\n🔑 *ايديك:* \`${existing.unique_id}\``,
          { parse_mode: 'Markdown', ...agentKeyboard() });
      }
      return bot.sendMessage(chatId,
        `✅ *أنت مسجل بالفعل!*\n🆔 *ايديك:* \`${existing.unique_id}\``,
        { parse_mode: 'Markdown', ...playerKeyboard() });
    }

    let newPlayer;
    try {
      newPlayer = await createPlayer({
        telegram_id: telegramId,
        full_name:   session.full_name,
        phone,
        agent_id:    session.agent_id
      });
    } catch (e) {
      deleteSession(chatId);
      console.error('createPlayer error:', e.message);
      return bot.sendMessage(chatId,
        `❌ حدث خطأ أثناء التسجيل\n\`${e.message}\``,
        { parse_mode: 'Markdown' });
    }

    deleteSession(chatId);

    return bot.sendMessage(chatId,
      `🎉 *تم التسجيل بنجاح في SpinX!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 *الاسم:* ${newPlayer.full_name}\n` +
      `🆔 *ايديك في اللعبة:* \`${newPlayer.unique_id}\`\n` +
      `📱 *رقم الهاتف:* ${phone}\n` +
      `💰 *رصيدك الابتدائي:* 0.00 دولار أمريكي 💵\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🎮 تواصل مع وكيلك لإضافة رصيد والبدء باللعب!`,
      { parse_mode: 'Markdown', ...playerKeyboard() });
  }
});
