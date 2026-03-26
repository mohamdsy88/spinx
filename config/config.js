const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

// 🔐 المتغيرات من Railway
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_ID = process.env.ADMIN_ID;

// 🤖 تشغيل البوت
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// 🗄️ الاتصال بقاعدة البيانات
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = {
  bot,
  supabase,
  ADMIN_ID
};
