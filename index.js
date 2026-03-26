// 🔧 تحميل الإعدادات (البوت + قاعدة البيانات)
require('./config/config');

// 🎯 نظام تسجيل اللاعبين
require('./handlers/registerHandler');

// 👑 لوحة الأدمن
require('./adminHandlers/adminPanel');

// 🚀 رسالة تشغيل
console.log("🚀 SpinX Bot is running...");
