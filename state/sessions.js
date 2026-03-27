// state/sessions.js
const sessions = {};

function getSession(chatId) {
  return sessions[chatId] || null;
}

function setSession(chatId, data) {
  sessions[chatId] = data;
}

function deleteSession(chatId) {
  delete sessions[chatId];
}

function updateSession(chatId, updates) {
  sessions[chatId] = { ...(sessions[chatId] || {}), ...updates };
}

module.exports = { getSession, setSession, deleteSession, updateSession };
