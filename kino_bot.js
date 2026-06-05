const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const TOKEN = "8897869307:AAEuqqCxs0oEH1SlzYICZJUFgpQJmJMb4pg";
const ADMIN_ID = 8150061698;
const USERS_FILE = "users.json";

const bot = new TelegramBot(TOKEN, { 
  polling: { 
    interval: 1000, 
    skipOldUpdates: true,
    allowedUpdates: ["message", "callback_query"]
  } 
});

// ===================== FOYDALANUVCHILAR =====================
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); } catch { return {}; }
}

function saveUser(userId, name) {
  const users = loadUsers();
  if (!users[userId]) {
    users[userId] = { name, joinedAt: new Date().toISOString() };
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  }
}

function getUserCount() {
  return Object.keys(loadUsers()).length;
}

function isAdmin(id) {
  return id === ADMIN_ID;
}

// ===================== /start =====================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || "Do'st";
  saveUser(chatId, name);

  if (isAdmin(chatId)) {
    const users = getUserCount();
    bot.sendMessage(
      chatId,
      `👑 <b>Admin panelga xush kelibsiz, ${name}!</b>\n\n` +
      `👥 Foydalanuvchilar: <b>${users} ta</b>\n\n` +
      `📢 /broadcast — Habar yuborish\n` +
      `👥 /users — Foydalanuvchilar soni`,
      { parse_mode: "HTML" }
    );
  } else {
    bot.sendMessage(
      chatId,
      `🎬 <b>Kino Botga xush kelibsiz, ${name}!</b>\n\n` +
      `Bot ishga tushdi. Tezda yangi funksiyalar qo'shiladi!`,
      { parse_mode: "HTML" }
    );
  }
});

// ===================== /users (admin) =====================
bot.onText(/\/users/, (msg) => {
  if (!isAdmin(msg.chat.id)) return;
  const users = getUserCount();
  bot.sendMessage(
    msg.chat.id,
    `👥 <b>Jami foydalanuvchilar: ${users} ta</b>`,
    { parse_mode: "HTML" }
  );
});

// ===================== /broadcast (admin) =====================
const broadcastState = {};

bot.onText(/\/broadcast/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) {
    bot.sendMessage(chatId, "⛔ Sizda ruxsat yo'q!");
    return;
  }

  broadcastState[chatId] = true;
  bot.sendMessage(
    chatId,
    `📢 <b>Barcha foydalanuvchilarga habar yuboring</b>\n\n` +
    `Xabaringizni yozing:`,
    { 
      parse_mode: "HTML",
      reply_markup: { 
        inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: "cancel_broadcast" }]] 
      }
    }
  );
});

// ===================== MESSAGE HANDLER =====================
bot.on("message", (msg) => {
  if (!msg.text) return;
  if (msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  saveUser(chatId, msg.from.first_name || "Do'st");

  // Broadcast habar yuborish
  if (isAdmin(chatId) && broadcastState[chatId]) {
    const messageText = msg.text;
    const users = loadUsers();
    let sentCount = 0;
    let errorCount = 0;

    Object.keys(users).forEach((userId) => {
      bot.sendMessage(userId, messageText, { parse_mode: "HTML" })
        .then(() => { sentCount++; })
        .catch((err) => { errorCount++; });
    });

    setTimeout(() => {
      delete broadcastState[chatId];
      bot.sendMessage(
        chatId,
        `✅ <b>Habar yuborildi!</b>\n\n` +
        `📤 Yuborilgan: <b>${sentCount}</b>\n` +
        `❌ Xatolar: <b>${errorCount}</b>`,
        { parse_mode: "HTML" }
      );
    }, 1000);

    return;
  }
});

// ===================== CALLBACK QUERY =====================
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "cancel_broadcast") {
    delete broadcastState[chatId];
    bot.answerCallbackQuery(query.id, { text: "Bekor qilindi" });
    bot.sendMessage(chatId, "❌ Broadcast bekor qilindi.");
    return;
  }

  bot.answerCallbackQuery(query.id);
});

// ===================== XATOLAR =====================
bot.on("polling_error", (err) => { 
  console.error("❌ Polling xatosi:", err.message); 
});

console.log("🎬 Kino Bot ishga tushdi!");
