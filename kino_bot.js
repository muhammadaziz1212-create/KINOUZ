/**
 * 🎬 KINO BOT - Admin Panel + Foydalanuvchilar soni
 */

const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const TOKEN = "8897869307:AAEuqqCxs0oEH1SlzYICZJUFgpQJmJMb4pg";
const ADMIN_ID = 8150061698;
const DB_FILE = "movies.json";
const USERS_FILE = "users.json";

const bot = new TelegramBot(TOKEN, { polling: { interval: 1000, allowedUpdates: ["message", "callback_query"], skipOldUpdates: true } });

// ===================== BAZA =====================
function loadMovies() {
  if (!fs.existsSync(DB_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch { return []; }
}

function saveMovies(movies) {
  fs.writeFileSync(DB_FILE, JSON.stringify(movies, null, 2), "utf8");
}

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

const adminState = {};

function isAdmin(id) {
  return id === ADMIN_ID;
}

// ===================== /start =====================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || "Do'st";

  saveUser(chatId, name);

  if (isAdmin(chatId)) {
    const movies = loadMovies();
    const users = getUserCount();
    bot.sendMessage(
      chatId,
      `👑 <b>Admin panelga xush kelibsiz, ${name}!</b>\n\n` +
        `👥 Foydalanuvchilar: <b>${users} ta</b>\n` +
        `🎬 Kinolar: <b>${movies.length} ta</b>\n\n` +
        `🎬 /addmovie — Kino qo'shish\n` +
        `📋 /list — Kinolar ro'yxati\n` +
        `🗑 /deletemovie — Kino o'chirish\n` +
        `📊 /stats — Statistika`,
      { parse_mode: "HTML" }
    );
  } else {
    bot.sendMessage(
      chatId,
      `🎬 <b>Kino Botga xush kelibsiz, ${name}!</b>\n\n` +
        `Kino nomi yoki janrini yozing — topib beraman!\n\n` +
        `📋 /list — Barcha kinolar\n` +
        `❓ /help — Yordam`,
      { parse_mode: "HTML" }
    );
  }
});

// ===================== /help =====================
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `❓ <b>Yordam</b>\n\n` +
      `• Kino nomini yozing — bot topadi\n` +
      `• Janr yozing (masalan: triller) — shu janrdagilar chiqadi\n` +
      `• /list — barcha kinolar`,
    { parse_mode: "HTML" }
  );
});

// ===================== /list =====================
bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;
  const movies = loadMovies();

  if (movies.length === 0) {
    bot.sendMessage(chatId, "😔 Hozircha kino yo'q. Tez kunda qo'shiladi!");
    return;
  }

  const buttons = movies.map((m) => [
    { text: `🎬 ${m.title} (${m.year})`, callback_data: `movie_${m.id}` },
  ]);

  bot.sendMessage(chatId, `📽 <b>Kinolar (${movies.length} ta):</b>`, {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });
});

// ===================== /stats (admin) =====================
bot.onText(/\/stats/, (msg) => {
  if (!isAdmin(msg.chat.id)) return;
  const movies = loadMovies();
  const users = getUserCount();
  bot.sendMessage(
    msg.chat.id,
    `📊 <b>Statistika</b>\n\n` +
      `👥 Foydalanuvchilar: <b>${users} ta</b>\n` +
      `🎬 Kinolar soni: <b>${movies.length} ta</b>`,
    { parse_mode: "HTML" }
  );
});

// ===================== /addmovie (admin) =====================
bot.onText(/\/addmovie/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) {
    bot.sendMessage(chatId, "⛔ Sizda ruxsat yo'q!");
    return;
  }

  adminState[chatId] = { step: "title", data: {} };
  bot.sendMessage(chatId, "🎬 <b>Kino qo'shish</b>\n\nKino nomini yozing:", {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: "cancel_add" }]] },
  });
});

// ===================== /deletemovie (admin) =====================
bot.onText(/\/deletemovie/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return;

  const movies = loadMovies();
  if (movies.length === 0) {
    bot.sendMessage(chatId, "😔 O'chiriladigan kino yo'q.");
    return;
  }

  const buttons = movies.map((m) => [
    { text: `🗑 ${m.title} (${m.year})`, callback_data: `delete_${m.id}` },
  ]);
  buttons.push([{ text: "❌ Bekor qilish", callback_data: "cancel_add" }]);

  bot.sendMessage(chatId, "🗑 <b>Qaysi kinoni o'chirmoqchisiz?</b>", {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });
});

// ===================== MATN HANDLER =====================
bot.on("message", (msg) => {
  if (!msg.text && !msg.video && !msg.document) return;
  if (msg.text && msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const name = msg.from.first_name || "Do'st";
  saveUser(chatId, name);

  if (isAdmin(chatId) && adminState[chatId]) {
    const state = adminState[chatId];

    if (state.step === "video") {
      let fileId = null;
      if (msg.video) fileId = msg.video.file_id;
      else if (msg.document) fileId = msg.document.file_id;
      else { bot.sendMessage(chatId, "⚠️ Iltimos, video yuboring!"); return; }

      const movies = loadMovies();
      const newMovie = {
        id: Date.now(),
        title: state.data.title,
        year: state.data.year,
        genre: state.data.genre,
        description: state.data.description,
        file_id: fileId,
      };
      movies.push(newMovie);
      saveMovies(movies);
      delete adminState[chatId];

      bot.sendMessage(
        chatId,
        `✅ <b>Kino qo'shildi!</b>\n\n` +
          `🎬 ${newMovie.title} (${newMovie.year})\n` +
          `🎭 ${newMovie.genre}\n` +
          `📝 ${newMovie.description}`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (!msg.text) return;

    if (state.step === "title") {
      state.data.title = msg.text;
      state.step = "year";
      bot.sendMessage(chatId, "📅 Yilini yozing (masalan: 2024):", {
        reply_markup: { inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: "cancel_add" }]] },
      });
    } else if (state.step === "year") {
      if (!/^\d{4}$/.test(msg.text)) { bot.sendMessage(chatId, "⚠️ To'g'ri yil yozing:"); return; }
      state.data.year = msg.text;
      state.step = "genre";
      bot.sendMessage(chatId, "🎭 Janrini yozing:", {
        reply_markup: { inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: "cancel_add" }]] },
      });
    } else if (state.step === "genre") {
      state.data.genre = msg.text;
      state.step = "description";
      bot.sendMessage(chatId, "📝 Qisqacha tavsif yozing:", {
        reply_markup: { inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: "cancel_add" }]] },
      });
    } else if (state.step === "description") {
      state.data.description = msg.text;
      state.step = "video";
      bot.sendMessage(
        chatId,
        `📹 <b>Videoni yuboring</b>\n\n` +
          `✅ Nomi: ${state.data.title}\n📅 Yil: ${state.data.year}\n` +
          `🎭 Janr: ${state.data.genre}\n📝 Tavsif: ${state.data.description}\n\n` +
          `Endi kinoning video faylini yuboring:`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: "cancel_add" }]] } }
      );
    }
    return;
  }

  if (!msg.text) return;
  const query = msg.text.trim().toLowerCase();
  const movies = loadMovies();

  const results = movies.filter(
    (m) =>
      m.title.toLowerCase().includes(query) ||
      m.genre.toLowerCase().includes(query) ||
      m.year.toString().includes(query)
  );

  if (results.length === 0) {
    bot.sendMessage(chatId, `😔 <b>"${msg.text}"</b> bo'yicha hech narsa topilmadi.\n\n/list — barcha kinolar`, { parse_mode: "HTML" });
    return;
  }

  if (results.length === 1) { sendMovieCard(chatId, results[0]); return; }

  const buttons = results.map((m) => [
    { text: `🎬 ${m.title} (${m.year})`, callback_data: `movie_${m.id}` },
  ]);
  bot.sendMessage(chatId, `🔍 <b>${results.length} ta natija:</b>`, {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });
});

// ===================== KINO KARTA =====================
function sendMovieCard(chatId, movie) {
  const text =
    `🎬 <b>${movie.title}</b> (${movie.year})\n` +
    `🎭 Janr: ${movie.genre}\n` +
    `📝 ${movie.description}`;

  bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "▶️ Kinoni ko'rish", callback_data: `watch_${movie.id}` }]] },
  });
}

// ===================== CALLBACK =====================
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const movies = loadMovies();

  if (data === "cancel_add") {
    delete adminState[chatId];
    bot.answerCallbackQuery(query.id, { text: "Bekor qilindi" });
    bot.sendMessage(chatId, "❌ Bekor qilindi.");
    return;
  }

  if (data.startsWith("movie_")) {
    const id = parseInt(data.replace("movie_", ""));
    const movie = movies.find((m) => m.id === id);
    if (!movie) return;
    bot.answerCallbackQuery(query.id);
    sendMovieCard(chatId, movie);
    return;
  }

  if (data.startsWith("watch_")) {
    const id = parseInt(data.replace("watch_", ""));
    const movie = movies.find((m) => m.id === id);
    if (!movie) return;
    bot.answerCallbackQuery(query.id, { text: "⏳ Yuborilmoqda..." });
    bot.sendVideo(chatId, movie.file_id, {
      caption: `🎬 <b>${movie.title}</b> (${movie.year})\n🎭 ${movie.genre}`,
      parse_mode: "HTML",
    });
    return;
  }

  if (data.startsWith("delete_")) {
    if (!isAdmin(chatId)) return;
    const id = parseInt(data.replace("delete_", ""));
    const index = movies.findIndex((m) => m.id === id);
    if (index === -1) return;
    const deleted = movies.splice(index, 1)[0];
    saveMovies(movies);
    bot.answerCallbackQuery(query.id, { text: "O'chirildi!" });
    bot.sendMessage(chatId, `🗑 <b>${deleted.title}</b> o'chirildi.`, { parse_mode: "HTML" });
    return;
  }
});

bot.on("polling_error", (err) => { console.error("❌ Xato:", err.message); });
console.log("🎬 Kino Bot ishga tushdi!");
