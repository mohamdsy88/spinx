const { supabase } = require('../config/config');
const { generateUserId, generateRequestId } = require('../utils/helpers');

async function getUserByTelegramId(telegram_id) {
  const { data } = await supabase.from('users').select('*').eq('telegram_id', telegram_id).single();
  return data || null;
}

async function getUserByUniqueId(unique_id) {
  const { data } = await supabase.from('users').select('*').eq('unique_id', String(unique_id).trim()).single();
  return data || null;
}

async function getUserById(id) {
  const { data } = await supabase.from('users').select('*').eq('id', id).single();
  return data || null;
}

async function createPlayer({ telegram_id, full_name, phone, agent_id }) {
  let unique_id = generateUserId();
  let attempts = 0;
  while (attempts < 10) {
    const { data: existing } = await supabase.from('users').select('id').eq('unique_id', unique_id).single();
    if (!existing) break;
    unique_id = generateUserId();
    attempts++;
  }
  const { data, error } = await supabase.from('users').insert([{
    telegram_id, unique_id, full_name, phone, role: 'player', agent_id, balance: 0, is_blocked: false
  }]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function createAgent({ telegram_id, full_name }) {
  let unique_id = generateUserId();
  let attempts = 0;
  while (attempts < 10) {
    const { data: existing } = await supabase.from('users').select('id').eq('unique_id', unique_id).single();
    if (!existing) break;
    unique_id = generateUserId();
    attempts++;
  }
  const { data, error } = await supabase.from('users').insert([{
    telegram_id, unique_id, full_name: full_name || 'وكيل', role: 'agent', balance: 0, is_blocked: false
  }]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function updateBalance(user_id, amount) {
  const { data: user } = await supabase.from('users').select('balance').eq('id', user_id).single();
  if (!user) throw new Error('المستخدم غير موجود');
  const newBalance = Number(user.balance) + Number(amount);
  const { data, error } = await supabase.from('users').update({ balance: newBalance }).eq('id', user_id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function blockUser(user_id) {
  const { error } = await supabase.from('users').update({ is_blocked: true }).eq('id', user_id);
  if (error) throw new Error(error.message);
}

async function unblockUser(user_id) {
  const { error } = await supabase.from('users').update({ is_blocked: false }).eq('id', user_id);
  if (error) throw new Error(error.message);
}

async function getStats() {
  const { data: players } = await supabase.from('users').select('balance').eq('role', 'player');
  const { data: agents } = await supabase.from('users').select('balance').eq('role', 'agent');
  const totalPlayerBalance = (players || []).reduce((sum, u) => sum + Number(u.balance), 0);
  const totalAgentBalance = (agents || []).reduce((sum, u) => sum + Number(u.balance), 0);
  return { playerCount: (players || []).length, agentCount: (agents || []).length, totalPlayerBalance, totalAgentBalance };
}

async function getAgentStats(agent_db_id) {
  const { data: players } = await supabase.from('users').select('*').eq('agent_id', agent_db_id).eq('role', 'player');
  const { data: requests } = await supabase.from('requests').select('*').eq('user_id', agent_db_id).eq('type', 'deposit');
  const { data: transfers } = await supabase.from('transactions').select('*').eq('from_user', agent_db_id);
  const totalRequested = (requests || []).reduce((s, r) => s + Number(r.amount), 0);
  const totalTransferred = (transfers || []).reduce((s, t) => s + Number(t.amount), 0);
  return {
    players: players || [],
    requestCount: (requests || []).length,
    totalRequested,
    transferCount: (transfers || []).length,
    totalTransferred
  };
}

async function createRequest({ user_id, type, amount }) {
  const request_id = generateRequestId();
  const { data, error } = await supabase.from('requests').insert([{ request_id, user_id, type, amount, status: 'pending' }]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function updateRequestStatus(request_id, status) {
  const { data, error } = await supabase.from('requests').update({ status }).eq('request_id', request_id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function getRequestById(request_id) {
  const { data } = await supabase.from('requests').select('*').eq('request_id', request_id).single();
  return data || null;
}

async function logTransaction({ from_user, to_user, amount, type }) {
  await supabase.from('transactions').insert([{ from_user, to_user, amount, type }]);
}

module.exports = {
  getUserByTelegramId, getUserByUniqueId, getUserById,
  createPlayer, createAgent, updateBalance,
  blockUser, unblockUser, getStats, getAgentStats,
  createRequest, updateRequestStatus, getRequestById, logTransaction
};
