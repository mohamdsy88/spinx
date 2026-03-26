const { supabase } = require('../config/config');
const { generateUserId } = require('../utils/helpers');

// 🔍 البحث عن مستخدم عبر Telegram ID
async function getUserByTelegramId(telegram_id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegram_id)
    .single();

  return data;
}

// 🔍 البحث عن مستخدم عبر ID الخاص (6 أرقام)
async function getUserByUniqueId(unique_id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('unique_id', unique_id)
    .single();

  return data;
}

// ➕ إنشاء لاعب جديد
async function createPlayer({ telegram_id, full_name, phone, agent_id }) {
  const unique_id = generateUserId();

  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        telegram_id,
        unique_id,
        full_name,
        phone,
        role: 'player',
        agent_id,
        balance: 0
      }
    ])
    .select()
    .single();

  return data;
}

// ➕ إنشاء وكيل
async function createAgent({ telegram_id }) {
  const unique_id = generateUserId();

  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        telegram_id,
        unique_id,
        role: 'agent',
        balance: 0
      }
    ])
    .select()
    .single();

  return data;
}

// 💰 تحديث الرصيد
async function updateBalance(user_id, amount) {
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', user_id)
    .single();

  const newBalance = Number(user.balance) + Number(amount);

  const { data, error } = await supabase
    .from('users')
    .update({ balance: newBalance })
    .eq('id', user_id)
    .select()
    .single();

  return data;
}

// ❄️ تجميد الحساب
async function blockUser(user_id) {
  await supabase
    .from('users')
    .update({ is_blocked: true })
    .eq('id', user_id);
}

// 🔓 فك التجميد
async function unblockUser(user_id) {
  await supabase
    .from('users')
    .update({ is_blocked: false })
    .eq('id', user_id);
}

module.exports = {
  getUserByTelegramId,
  getUserByUniqueId,
  createPlayer,
  createAgent,
  updateBalance,
  blockUser,
  unblockUser
};
