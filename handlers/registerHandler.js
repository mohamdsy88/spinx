const { bot, ADMIN_ID } = require('../config/config');
const { getUserByTelegramId, getUserByUniqueId, createPlayer } = require('../services/userService');
const { startRegisterKeyboard, phoneKeyboard, removeKeyboard, playerKeyboard } = require('../keyboards/mainKeyboard');
const { formatUSD, formatDate } = require('../utils/helpers');

const registerSessions = {};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const existingUser = await getUserByTelegramId(msg.from.id);

  if (existingUser) {
    if (existingUser.is_blocked) {
      return bot.sendMessage(chatId, '🚫 حسابك في مرحلة التجميد\nالرجاء التواصل مع الإدارة');
    }
    return bot.sendMessage(chatId, `✅ أنت مسجل بالفعل في SpinX\n\n🆔 ايديك: ${existingUser.unique_id}\n💰 رصيدك: ${formatUSD(existingUser.balance)}`);
  }

  bot.sendMessage(chatId,
    `🎮 *مرحباً بك في SpinX!*

━━━━━━━━━━━━━━━━━
🎰 *وصف اللعبة:*
نظام مراهنات رقمي يعمل عبر تيليغرام باستخدام الدولار الأمريكي 💵

🏗️ *هيكل النظام:*
👑 الإدارة الرئيسية — الإشراف الكامل
🧑‍💼 الوكلاء — إدارة حسابات اللاعبين
🎮 اللاعبون — المشاركة والمراهنة

📜 *القواعد الأساسية:*
• تقديم معلومات صحيحة عند التسجيل
• حساب واحد لكل شخص فقط
• جميع العمليات المالية عبر الوكيل

⚖️ *إخلاء المسؤولية:*
• اللاعب مسؤول كامل عن قراراته
• الإدارة غير مسؤولة عن الخسائر
• قرارات الإدارة نهائية وغير قابلة للطعن

🔒 بالضغط على زر التسجيل أنت توافق على جميع الشروط

👇 *اضغط لبدء التسجيل*`,
    { parse_mode: 'Markdown', ...startRegisterKeyboard() }
  );
});

bot.on('callback_query', async (query) => {
  if (query.data !== 'start_register') return;
  const chatId = query.message.chat.id;
  await bot.answerCallbackQuery(query.id);
  const existingUser = await getUserByTelegramId(query.from.id);
  if (existingUser) return bot.sendMessage(chatId, '✅ أنت مسجل بالفعل في SpinX');
  registerSessions[chatId] = {};
  bot.sendMessage(chatId,
    `📝 *خطوة 1 من 3*\n\n🧑‍💼 الرجاء أرسل ايدي الوكيل المسؤول عن حسابك\n_(الايدي مكون من 6 أرقام)_`,
    { parse_mode: 'Markdown', ...removeKeyboard() }
  );
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!registerSessions[chatId]) return;
  const session = registerSessions[chatId];

  // الخطوة 1: ايدي الوكيل
  if (!session.agent) {
    if (!msg.text) return;
    const agent = await getUserByUniqueId(msg.text.trim());
    if (!agent || agent.role !== 'agent') {
      return bot.sendMessage(chatId, `❌ *هذا الايدي غير موجود!*\n\nالرجاء التحقق من الوكيل ليمنحك الايدي الصحيح`, { parse_mode: 'Markdown' });
    }
    session.agent = agent;
    return bot.sendMessage(chatId,
      `✅ *الوكيل موجود!*\n\n🧑‍💼 اسم الوكيل: ${agent.full_name || 'غير محدد'}\n\n📝 *خطوة 2 من 3*\n✍️ الرجاء أرسل اسمك الكامل`,
      { parse_mode: 'Markdown' }
    );
  }

  // الخطوة 2: الاسم الكامل
  if (!session.full_name) {
    if (!msg.text || msg.text.trim().length < 2) return bot.sendMessage(chatId, '❌ الاسم قصير جداً، الرجاء إدخال اسمك الكامل');
    session.full_name = msg.text.trim();
    return bot.sendMessage(chatId,
      `✅ تم حفظ الاسم: *${session.full_name}*\n\n📝 *خطوة 3 من 3*\n📱 الرجاء شارك رقم هاتفك بالضغط على الزر أدناه`,
      { parse_mode: 'Markdown', ...phoneKeyboard() }
    );
  }

  // الخطوة 3: رقم الهاتف
  if (!session.phone && msg.contact) {
    session.phone = msg.contact.phone_number;
    try {
      const newUser = await createPlayer({
        telegram_id: msg.from.id,
        full_name: session.full_name,
        phone: session.phone,
        agent_id: session.agent.id
      });
      delete registerSessions[chatId];
      const now = formatDate();

      bot.sendMessage(chatId,
        `🎉 *تم تسجيلك بنجاح في SpinX!*

━━━━━━━━━━━━━━━━━
👤 الاسم: ${newUser.full_name}
🆔 ايديك الخاص: \`${newUser.unique_id}\`
🧑‍💼 الوكيل: ${session.agent.full_name || 'غير محدد'} (\`${session.agent.unique_id}\`)
💰 رصيدك الحالي: ${formatUSD(newUser.balance)}
━━━━━━━━━━━━━━━━━
⏰ ${now}

🔥 استعد للعب وابدأ رحلتك مع SpinX!`,
        { parse_mode: 'Markdown', ...playerKeyboard() }
      );

      bot.sendMessage(ADMIN_ID,
        `🚨 *لاعب جديد انضم للعبة!*

━━━━━━━━━━━━━━━━━
👤 الاسم: ${newUser.full_name}
📞 رقم الهاتف: ${session.phone}
🆔 ايدي اللاعب: \`${newUser.unique_id}\`
🧑‍💼 الوكيل: ${session.agent.full_name || 'غير محدد'} (\`${session.agent.unique_id}\`)
📅 تاريخ التسجيل: ${now}
━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );

      bot.sendMessage(session.agent.telegram_id,
        `🎉 *لاعب جديد انضم إلى فريقك!*

━━━━━━━━━━━━━━━━━
👤 اسم اللاعب: ${newUser.full_name}
🆔 ايدي اللاعب: \`${newUser.unique_id}\`
📅 تاريخ الانضمام: ${now}
━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      delete registerSessions[chatId];
      bot.sendMessage(chatId, `❌ حدث خطأ أثناء التسجيل، الرجاء المحاولة مرة أخرى\n\n/start`, removeKeyboard());
    }
  }
});

module.exports = { registerSessions };
