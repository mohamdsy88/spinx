const { bot, ADMIN_ID } = require('../config/config');
const { 
  getUserByUniqueId, 
  updateBalance, 
  createAgent, 
  blockUser, 
  unblockUser 
} = require('../services/userService');
const { formatUSD, formatDate } = require('../utils/helpers');
const { adminKeyboard } = require('../keyboards/mainKeyboard');

// 🧠 جلسات الأدمن
const adminSessions = {};

// 👑 فتح لوحة الأدمن
bot.onText(/\/admin/, (msg) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;

  bot.sendMessage(msg.chat.id, "👑 لوحة تحكم الأدمن", adminKeyboard());
});

// ➕ إضافة رصيد
bot.on('message', async (msg) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;

  const text = msg.text;
  const chatId = msg.chat.id;

  if (text === "➕ إضافة رصيد") {
    adminSessions[chatId] = { action: 'add_balance' };

    return bot.sendMessage(chatId, "📨 اختر النوع:\n1️⃣ لاعب\n2️⃣ وكيل");
  }

  // اختيار لاعب أو وكيل
  if (adminSessions[chatId]?.action === 'add_balance' && !adminSessions[chatId].type) {
    if (text === "لاعب" || text === "وكيل") {
      adminSessions[chatId].type = text;

      return bot.sendMessage(chatId, "📨 ارسل ايدي الحساب");
    }
  }

  // إدخال ID
  if (adminSessions[chatId]?.type && !adminSessions[chatId].user) {
    const user = await getUserByUniqueId(text);

    if (!user) {
      return bot.sendMessage(chatId, "❌ الحساب غير موجود");
    }

    adminSessions[chatId].user = user;

    return bot.sendMessage(
      chatId,
      `✅ تم العثور على الحساب

👤 ${user.full_name || '---'}
🆔 ${user.unique_id}
💰 ${formatUSD(user.balance)}

💸 ارسل المبلغ`
    );
  }

  // إدخال المبلغ
  if (adminSessions[chatId]?.user && !adminSessions[chatId].amount) {
    const amount = Number(text);

    if (isNaN(amount)) return;

    const updatedUser = await updateBalance(adminSessions[chatId].user.id, amount);

    // 👑 إشعار الأدمن
    bot.sendMessage(
      chatId,
      `✅ تمت إضافة الرصيد

👤 ${updatedUser.full_name}
💰 +${formatUSD(amount)}
💼 الرصيد الجديد: ${formatUSD(updatedUser.balance)}
⏰ ${formatDate()}`
    );

    // 👤 إشعار المستخدم
    bot.sendMessage(
      updatedUser.telegram_id,
      `💰 تحديث على رصيدك

➕ تم إضافة ${formatUSD(amount)}
💼 رصيدك الحالي: ${formatUSD(updatedUser.balance)}
📅 ${formatDate()}`
    );

    delete adminSessions[chatId];
  }

  // 👤 إضافة وكيل
  if (text === "👤 إضافة وكيل") {
    adminSessions[chatId] = { action: 'add_agent' };

    return bot.sendMessage(chatId, "📨 ارسل Telegram ID الخاص بالوكيل");
  }

  if (adminSessions[chatId]?.action === 'add_agent') {
    const telegram_id = Number(text);

    const agent = await createAgent({ telegram_id });

    bot.sendMessage(
      chatId,
      `✅ تم إضافة وكيل

🆔 ${agent.unique_id}`
    );

    bot.sendMessage(
      telegram_id,
      `🎉 مبروك!

تم تعيينك كوكيل في SpinX

🆔 ايديك: ${agent.unique_id}`
    );

    delete adminSessions[chatId];
  }

  // ❄️ تجميد حساب
  if (text === "❄️ تجميد حساب") {
    adminSessions[chatId] = { action: 'block' };

    return bot.sendMessage(chatId, "📨 ارسل ايدي الحساب");
  }

  if (adminSessions[chatId]?.action === 'block') {
    const user = await getUserByUniqueId(text);

    if (!user) return bot.sendMessage(chatId, "❌ غير موجود");

    await blockUser(user.id);

    bot.sendMessage(chatId, "❄️ تم تجميد الحساب");

    bot.sendMessage(user.telegram_id, "🚫 تم تجميد حسابك");
  }

  // 🔓 فك التجميد
  if (text === "🔓 فك التجميد") {
    adminSessions[chatId] = { action: 'unblock' };

    return bot.sendMessage(chatId, "📨 ارسل ايدي الحساب");
  }

  if (adminSessions[chatId]?.action === 'unblock') {
    const user = await getUserByUniqueId(text);

    if (!user) return bot.sendMessage(chatId, "❌ غير موجود");

    await unblockUser(user.id);

    bot.sendMessage(chatId, "✅ تم فك التجميد");

    bot.sendMessage(user.telegram_id, "✅ تم فك تجميد حسابك");
  }
});
