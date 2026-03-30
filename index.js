// index.js
const { bot, ADMIN_ID } = require('./config/config');
const { getUserByTelegramId } = require('./services/userService');
const { adminKeyboard, agentKeyboard, playerKeyboard, startRegisterKeyboard } = require('./keyboards/mainKeyboard');
const https = require('https');

// تحميل جميع المعالجات
require('./adminHandlers/adminPanel');
require('./agentHandlers/agentPanel');
require('./playerHandlers/playerPanel');
require('./handlers/registerHandler');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  /start — نقطة الدخول الرئيسية
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
bot.onText(/\/start/, async (msg) => {
  const chatId      = msg.chat.id;
  const telegramId  = msg.from.id;

  // 👑 أدمن
  if (telegramId.toString() === ADMIN_ID.toString()) {
    return bot.sendMessage(chatId,
      `👑 *مرحباً بك في لوحة تحكم SpinX*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `اختر من القائمة أدناه:`,
      { parse_mode: 'Markdown', ...adminKeyboard() });
  }

  const user = await getUserByTelegramId(telegramId);

  // 🧑‍💼 وكيل موجود
  if (user && user.role === 'agent') {
    return bot.sendMessage(chatId,
      `🧑‍💼 *مرحباً ${user.full_name || 'وكيل'}!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🔑 *ايديك:* \`${user.unique_id}\`\n` +
      `💰 *رصيدك:* ${user.balance.toFixed(2)} دولار أمريكي 💵\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown', ...agentKeyboard() });
  }

  // 🎮 لاعب موجود
  if (user && user.role === 'player') {
    if (user.is_blocked) {
      return bot.sendMessage(chatId,
        `🚫 *حسابك مجمد*\n\nتواصل مع الإدارة: @SpinXAdmin`,
        { parse_mode: 'Markdown' });
    }

    return bot.sendMessage(chatId,
      `🎮 *مرحباً ${user.full_name}!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🆔 *ايديك:* \`${user.unique_id}\`\n` +
      `💰 *رصيدك:* ${user.balance.toFixed(2)} دولار أمريكي 💵\n` +
      `━━━━━━━━━━━━━━━━`,
      { parse_mode: 'Markdown', ...playerKeyboard() });
  }

  // 🆕 مستخدم جديد — عرض زر التسجيل
  return bot.sendMessage(chatId,
    `🎰 *مرحباً بك في SpinX!*\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🎮 بوت ألعاب القمار الأول\n` +
    `💵 العملة: دولار أمريكي\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `اضغط الزر أدناه للتسجيل:`,
    { parse_mode: 'Markdown', ...startRegisterKeyboard() });
});

console.log('🚀 SpinX Bot is running...');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  إزالة المستطيل الأزرق (Menu Button)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BOT_TOKEN = process.env.BOT_TOKEN;
const menuBtnPayload = JSON.stringify({ menu_button: { type: 'commands' } });

const menuReq = https.request(
  {
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/setMyMenuButton`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(menuBtnPayload)
    }
  },
  (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      const result = JSON.parse(body);
      if (result.ok) console.log('✅ تم إزالة زر القائمة الأزرق بنجاح');
      else console.log('⚠️ فشل إزالة الزر الأزرق:', result.description);
    });
  }
);
menuReq.on('error', (e) => console.log('⚠️ خطأ في إزالة الزر الأزرق:', e.message));
menuReq.write(menuBtnPayload);
menuReq.end();
