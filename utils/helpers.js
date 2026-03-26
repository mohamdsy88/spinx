// 🎲 توليد ID عشوائي من 6 أرقام
function generateUserId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 💰 تنسيق الرصيد بالدولار
function formatUSD(amount) {
  return `${amount} USD 💵`;
}

// ⏰ تنسيق التاريخ والوقت
function formatDate(date = new Date()) {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

module.exports = {
  generateUserId,
  formatUSD,
  formatDate
};
