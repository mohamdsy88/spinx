// services/userService.js
const { supabase } = require('../config/config');
const { generateUserId } = require('../utils/helpers');

async function getUserByTelegramId(telegram_id) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegram_id)
    .single();
  return data || null;
}

async function getUserByUniqueId(unique_id) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('unique_id', unique_id)
    .single();
  return data || null;
}

async function getUserById(id) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  return data || null;
}

async function createPlayer({ telegram_id, full_name, phone, agent_id }) {
  const unique_id = generateUserId();
  const { data, error } = await supabase
    .from('users')
    .insert([{ telegram_id, unique_id, full_name, phone, role: 'player', agent_id, balance: 0 }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function createAgent({ telegram_id }) {
  // التحقق من عدم وجوده مسبقاً
  const existing = await getUserByTelegramId(telegram_id);
  if (existing) throw new Error('ALREADY_EXISTS');

  const unique_id = generateUserId();
  const { data, error } = await supabase
    .from('users')
    .insert([{ telegram_id, unique_id, role: 'agent', balance: 0 }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function updateBalance(user_id, amount) {
  const { data: user } = await supabase
    .from('users').select('*').eq('id', user_id).single();
  if (!user) return null;

  const newBalance = Math.max(0, Number(user.balance) + Number(amount));
  const { data } = await supabase
    .from('users')
    .update({ balance: newBalance })
    .eq('id', user_id)
    .select()
    .single();
  return data;
}

async function blockUser(user_id) {
  const { data } = await supabase
    .from('users')
    .update({ is_blocked: true })
    .eq('id', user_id)
    .select()
    .single();
  return data;
}

async function unblockUser(user_id) {
  const { data } = await supabase
    .from('users')
    .update({ is_blocked: false })
    .eq('id', user_id)
    .select()
    .single();
  return data;
}

async function getAllPlayers() {
  const { data } = await supabase
    .from('users').select('*').eq('role', 'player');
  return data || [];
}

async function getAllAgents() {
  const { data } = await supabase
    .from('users').select('*').eq('role', 'agent');
  return data || [];
}

async function getAllUsers() {
  const { data } = await supabase
    .from('users').select('*').neq('role', 'admin');
  return data || [];
}

async function getPlayersByAgent(agent_id) {
  const { data } = await supabase
    .from('users').select('*').eq('role', 'player').eq('agent_id', agent_id);
  return data || [];
}

async function setLuckControl(user_id, type, amount) {
  // احذف أي سجل قديم لهذا المستخدم
  await supabase.from('luck_control').delete().eq('user_id', user_id);
  const { data } = await supabase
    .from('luck_control')
    .insert([{ user_id, type, amount, used_amount: 0 }])
    .select()
    .single();
  return data;
}

async function getLuckControl(user_id) {
  const { data } = await supabase
    .from('luck_control')
    .select('*')
    .eq('user_id', user_id)
    .single();
  return data || null;
}

async function updateLuckUsed(luck_id, used_amount) {
  await supabase
    .from('luck_control')
    .update({ used_amount })
    .eq('id', luck_id);
}

async function deleteLuckControl(user_id) {
  await supabase.from('luck_control').delete().eq('user_id', user_id);
}

async function saveRequest({ request_id, user_id, agent_id, type, amount }) {
  const { data } = await supabase
    .from('requests')
    .insert([{ request_id, user_id, agent_id, type, amount, status: 'pending' }])
    .select()
    .single();
  return data;
}

async function updateRequestStatus(request_id, status) {
  const { data } = await supabase
    .from('requests')
    .update({ status })
    .eq('request_id', request_id)
    .select()
    .single();
  return data;
}

async function getRequestByRequestId(request_id) {
  const { data } = await supabase
    .from('requests')
    .select('*')
    .eq('request_id', request_id)
    .eq('status', 'pending')
    .single();
  return data || null;
}

async function countAgentRequests(agent_db_id) {
  const { data } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', agent_db_id)
    .eq('type', 'deposit');
  return data || [];
}

async function countAgentTransfers(agent_db_id) {
  const { data } = await supabase
    .from('requests')
    .select('*')
    .eq('agent_id', agent_db_id)
    .eq('type', 'withdraw');
  return data || [];
}

module.exports = {
  getUserByTelegramId, getUserByUniqueId, getUserById,
  createPlayer, createAgent,
  updateBalance, blockUser, unblockUser,
  getAllPlayers, getAllAgents, getAllUsers, getPlayersByAgent,
  setLuckControl, getLuckControl, updateLuckUsed, deleteLuckControl,
  saveRequest, updateRequestStatus, getRequestByRequestId,
  countAgentRequests, countAgentTransfers
};
