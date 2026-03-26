function startRegisterKeyboard() {
  return { reply_markup: { inline_keyboard: [[{ text: '🎮 بدء التسجيل في SpinX', callback_data: 'start_register' }]] } };
}

function phoneKeyboard() {
  return { reply_markup: { keyboard: [[{ text: '📱 مشاركة رقم الهاتف', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } };
}

function removeKeyboard() {
  return { reply_markup: { remove_keyboard: true } };
}

function playerKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['💰 التحقق من الرصيد', '🎰 ابدأ اللعب'],
        ['📤 طلب سحب رصيد', '📞 تواصل مع الإدارة']
      ],
      resize_keyboard: true
    }
  };
}

function agentKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['📥 طلب رصيد من الإدارة', '💸 تحويل رصيد للاعب'],
        ['💰 التحقق من الرصيد', '📊 الإحصائيات']
      ],
      resize_keyboard: true
    }
  };
}

function adminKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['➕ إضافة رصيد', '➖ خصم رصيد'],
        ['👤 إضافة وكيل', '❄️ تجميد حساب'],
        ['🔓 فك التجميد', '📢 إشعار للجميع'],
        ['✉️ رسالة خاصة', '🎯 ضربة حظ'],
        ['💀 حظ أوفر', '📊 الإحصائيات']
      ],
      resize_keyboard: true
    }
  };
}

function chooseTypeKeyboard(action) {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '👤 لاعب', callback_data: `${action}_player` },
        { text: '🧑‍💼 وكيل', callback_data: `${action}_agent` }
      ]]
    }
  };
}

function betKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '$0.10', callback_data: 'bet_0.10' },
          { text: '$0.25', callback_data: 'bet_0.25' },
          { text: '$0.50', callback_data: 'bet_0.50' },
          { text: '$1', callback_data: 'bet_1' }
        ],
        [
          { text: '$2', callback_data: 'bet_2' },
          { text: '$3', callback_data: 'bet_3' },
          { text: '$4', callback_data: 'bet_4' },
          { text: '$5', callback_data: 'bet_5' }
        ],
        [
          { text: '$6', callback_data: 'bet_6' },
          { text: '$7', callback_data: 'bet_7' },
          { text: '$8', callback_data: 'bet_8' },
          { text: '$9', callback_data: 'bet_9' }
        ],
        [{ text: '$10', callback_data: 'bet_10' }],
        [{ text: '🔙 الرجوع', callback_data: 'back_to_menu' }]
      ]
    }
  };
}

function playAgainKeyboard(bet) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: `🔄 العب مرة أخرى ($${bet})`, callback_data: `bet_${bet}` },
          { text: '🎲 تغيير الرهان', callback_data: 'open_game' }
        ],
        [{ text: '🔙 القائمة الرئيسية', callback_data: 'back_to_menu' }]
      ]
    }
  };
}

function approveRejectKeyboard(type, request_id) {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ قبول', callback_data: `approve_${type}_${request_id}` },
        { text: '❌ رفض', callback_data: `reject_${type}_${request_id}` }
      ]]
    }
  };
}

module.exports = {
  startRegisterKeyboard, phoneKeyboard, removeKeyboard,
  playerKeyboard, agentKeyboard, adminKeyboard,
  chooseTypeKeyboard, betKeyboard, playAgainKeyboard, approveRejectKeyboard
};
