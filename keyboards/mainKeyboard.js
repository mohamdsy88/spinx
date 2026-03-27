// keyboards/mainKeyboard.js

function startRegisterKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎮 بدء التسجيل في SpinX", callback_data: "start_register" }]
      ]
    }
  };
}

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

function removeKeyboard() {
  return { reply_markup: { remove_keyboard: true } };
}

function playerKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ["💰 رصيدي", "🎮 ابدأ اللعب"],
        ["📤 طلب سحب رصيد"],
        ["📞 تواصل مع الإدارة"]
      ],
      resize_keyboard: true
    }
  };
}

function agentKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ["📥 طلب رصيد من الإدارة", "💸 تحويل رصيد للاعب"],
        ["💰 رصيدي", "📊 إحصائياتي"]
      ],
      resize_keyboard: true
    }
  };
}

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

function targetTypeKeyboard(prefix) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "👤 لاعب", callback_data: `${prefix}_player` },
          { text: "🧑‍💼 وكيل", callback_data: `${prefix}_agent` }
        ]
      ]
    }
  };
}

function betKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "0.10$", callback_data: "bet_0.10" },
          { text: "0.25$", callback_data: "bet_0.25" },
          { text: "0.50$", callback_data: "bet_0.50" },
          { text: "1$",    callback_data: "bet_1" }
        ],
        [
          { text: "2$",  callback_data: "bet_2" },
          { text: "3$",  callback_data: "bet_3" },
          { text: "4$",  callback_data: "bet_4" },
          { text: "5$",  callback_data: "bet_5" }
        ],
        [
          { text: "6$",  callback_data: "bet_6" },
          { text: "7$",  callback_data: "bet_7" },
          { text: "8$",  callback_data: "bet_8" },
          { text: "9$",  callback_data: "bet_9" },
          { text: "10$", callback_data: "bet_10" }
        ],
        [{ text: "🚪 الخروج من اللعبة", callback_data: "exit_game" }]
      ]
    }
  };
}

function approveRejectKeyboard(prefix, requestId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ قبول", callback_data: `${prefix}_approve_${requestId}` },
          { text: "❌ رفض",  callback_data: `${prefix}_reject_${requestId}` }
        ]
      ]
    }
  };
}

module.exports = {
  startRegisterKeyboard, phoneKeyboard, removeKeyboard,
  playerKeyboard, agentKeyboard, adminKeyboard,
  targetTypeKeyboard, betKeyboard, approveRejectKeyboard
};
