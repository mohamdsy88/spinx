// config/config.js
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN   = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_ID     = process.env.ADMIN_ID;

if (!BOT_TOKEN)    throw new Error('❌ BOT_TOKEN غير موجود');
if (!SUPABASE_URL) throw new Error('❌ SUPABASE_URL غير موجود');
if (!SUPABASE_KEY) throw new Error('❌ SUPABASE_KEY غير موجود');
if (!ADMIN_ID)     throw new Error('❌ ADMIN_ID غير موجود');

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = { bot, supabase, ADMIN_ID };
