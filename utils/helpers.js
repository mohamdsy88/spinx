// utils/helpers.js

function generateUserId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateRequestId() {
  return 'REQ-' + Math.floor(100000 + Math.random() * 900000).toString();
}

function formatUSD(amount) {
  const num = Number(amount);
  return `${num.toFixed(2)} دولار أمريكي 💵`;
}

function formatDate(date = new Date()) {
  return date.toLocaleString('ar-EG', {
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Riyadh'
  });
}

module.exports = { generateUserId, generateRequestId, formatUSD, formatDate };
