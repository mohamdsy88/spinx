const { bot, ADMIN_ID } = require('../config/config');
const { getUserByTelegramId, getUserByUniqueId, createPlayer } = require('../services/userService');
const { startRegisterKeyboard, phoneKeyboard } = require('../keyboards/mainKeyboard');
const { formatUSD } = require('../utils/helpers');

// 🧠 تخزين مؤقت للتسجيل
const registerSessions = {};

// ▶️ عند /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const user = await getUserByTelegramId(chatId);

  if (user) {
    return bot.sendMessage(chatId, "✅ أنت مسجل بالفعل");
  }

  bot.sendMessage(
    chatId,
    `🎮 مرحباً بك في SpinX

📜 وصف اللعبة:
نظام مراهنات رقمي باستخدام الدولار الأمريكي 💵

⚖️ باستخدامك للبوت أنت توافق على جميع الشروط

👇 اضغط لبدء التسجيل`,
    startRegisterKeyboard()
  );
});

// 🎯 زر بدء التسجيل
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;

  if (query.data === "start_register") {
    registerSessions[chatId] = {};

    bot.sendMessage(chatId, "📨 الرجاء ارسل ايدي الوكيل المسؤول عن حسابك");
  }
});

// 📩 استقبال الرسائل
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  // ❌ تجاهل إذا مو داخل تسجيل
  if (!registerSessions[chatId]) return;

  const session = registerSessions[chatId];

  // 1️⃣ إدخال ID الوكيل
  if (!session.agent) {
    const agent = await getUserByUniqueId(msg.text);

    if (!agent || agent.role !== 'agent') {
      return bot.sendMessage(chatId, "❌ هذا الايدي غير موجود، تحقق من الوكيل");
    }

    session.agent = agent;

    return bot.sendMessage(
      chatId,
      `✅ الوكيل موجود: ${agent.full_name || 'بدون اسم'}

✍️ الرجاء ارسل اسمك الكامل`
    );
  }

  // 2️⃣ إدخال الاسم
  if (!session.full_name) {
    session.full_name = msg.text;

    return bot.sendMessage(
      chatId,
      "📱 الرجاء شارك رقم هاتفك",
      phoneKeyboard()
    );
  }

  // 3️⃣ استقبال رقم الهاتف
  if (!session.phone && msg.contact) {
    session.phone = msg.contact.phone_number;

    // ✅ إنشاء اللاعب
    const newUser = await createPlayer({
      telegram_id: chatId,
      full_name: session.full_name,
      phone: session.phone,
      agent_id: session.agent.id
    });

    delete registerSessions[chatId];

    // 🎉 إشعار اللاعب
    bot.sendMessage(
      chatId,
      `✅ تم تسجيلك بنجاح 🎉

👤 الاسم: ${newUser.full_name}
🆔 ايديك: ${newUser.unique_id}
🧑‍💼 الوكيل: ${session.agent.full_name || 'بدون اسم'}
💰 الرصيد: ${formatUSD(newUser.balance)}`
    );

    // 👑 إشعار الأدمن
    bot.sendMessage(
      ADMIN_ID,
      `🚨 لاعب جديد

👤 ${newUser.full_name}
📞 ${session.phone}
🆔 ${newUser.unique_id}
🧑‍💼 وكيله: ${session.agent.unique_id}`
    );

    // 🧑‍💼 إشعار الوكيل
    bot.sendMessage(
      session.agent.telegram_id,
      `🎉 لاعب جديد انضم إليك

👤 ${newUser.full_name}
🆔 ${newUser.unique_id}`
    );
  }
});
