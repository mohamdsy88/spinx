function generateUserId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatUSD(amount) {
  const num = Number(amount) || 0;
  return `${num.toFixed(2)} USD 💵`;
}

function formatDate(date = new Date()) {
  return date.toLocaleString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function generateRequestId() {
  return 'REQ' + Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = { generateUserId, formatUSD, formatDate, generateRequestId };
