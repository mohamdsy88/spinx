// 🎯 زر بدء التسجيل
function startRegisterKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎮 بدء التسجيل في SpinX", callback_data: "start_register" }]
      ]
    }
  };
}

// 📱 زر مشاركة رقم الهاتف
function phoneKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: "📱 مشاركة رقم الهاتف", request_contact: true }]
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  };
}

// 👤 لوحة اللاعب
function playerKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ["💰 التحقق من الرصيد"],
        ["📤 طلب سحب رصيد"],
        ["🎮 ابدأ اللعب"],
        ["📞 تواصل مع الإدارة"]
      ],
      resize_keyboard: true
    }
  };
}

// 🧑‍💼 لوحة الوكيل
function agentKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ["📥 طلب رصيد من الإدارة"],
        ["💸 تحويل رصيد للاعب"],
        ["💰 التحقق من الرصيد"],
        ["📊 الإحصائيات"]
      ],
      resize_keyboard: true
    }
  };
}

// 👑 لوحة الأدمن
function adminKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ["➕ إضافة رصيد", "➖ خصم رصيد"],
        ["👤 إضافة وكيل", "❄️ تجميد حساب"],
        ["🔓 فك التجميد", "📢 إشعار للجميع"],
        ["✉️ رسالة خاصة", "🎯 ضربة حظ"],
        ["💀 حظ أوفر", "📊 الإحصائيات"]
      ],
      resize_keyboard: true
    }
  };
}

module.exports = {
  startRegisterKeyboard,
  phoneKeyboard,
  playerKeyboard,
  agentKeyboard,
  adminKeyboard
};
