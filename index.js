require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

const fs = require("fs");
const path = require("path");

// =======================
// ⚙️ CONFIG
// =======================
const prefix = "!";
const color = 0x2b2d31;

// =======================
// 📁 FILE DATABASE VC
// =======================
const voiceFile = path.join(__dirname, "voice.json");

if (!fs.existsSync(voiceFile)) {
  fs.writeFileSync(voiceFile, JSON.stringify({}, null, 2));
}

function loadVoice() {
  return JSON.parse(fs.readFileSync(voiceFile));
}

function saveVoice(data) {
  fs.writeFileSync(voiceFile, JSON.stringify(data, null, 2));
}

// =======================
// 🤖 CLIENT
// =======================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =======================
// 🔊 JOIN VC (FINAL FIX)
// =======================
async function joinVC(guild, channelId) {
  try {
    const channel = await guild.channels.fetch(channelId); // 🔥 FIX CACHE

    if (!channel) return console.log("❌ Channel tidak ditemukan");

    // 🔒 Anti double connect
    const existing = getVoiceConnection(guild.id);
    if (existing) {
      console.log("⚠️ Sudah connect ke VC");
      return;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false
    });

    console.log(`🔄 Mencoba join VC: ${channel.id}`);

    // 🔁 Monitor state
    connection.on("stateChange", (oldState, newState) => {
      console.log(`STATE: ${oldState.status} -> ${newState.status}`);

      if (newState.status === VoiceConnectionStatus.Disconnected) {
        console.log("⚠️ Terputus, reconnect...");
        setTimeout(() => joinVC(guild, channelId), 5000);
      }
    });

    // ✅ VALIDASI MASUK
    await entersState(connection, VoiceConnectionStatus.Ready, 5000);
    console.log(`✅ BERHASIL MASUK VC: ${channel.id}`);

  } catch (err) {
    console.log("❌ Gagal join VC:", err.message);
    setTimeout(() => joinVC(guild, channelId), 5000);
  }
}

// =======================
// 🚀 READY (AUTO JOIN)
// =======================
client.once("ready", async () => {
  console.log(`🔥 Login sebagai ${client.user.tag}`);

  const data = loadVoice();

  for (const guildId in data) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    setTimeout(() => {
      joinVC(guild, data[guildId]);
    }, 3000);
  }
});

// =======================
// 🔁 AUTO CHECK (ANTI KELUAR)
// =======================
setInterval(() => {
  const data = loadVoice();

  for (const guildId in data) {
    const connection = getVoiceConnection(guildId);

    if (!connection) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      console.log("⚠️ Bot keluar VC, rejoin...");
      joinVC(guild, data[guildId]);
    }
  }
}, 15000);

// =======================
// 💬 COMMAND
// =======================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const embed = new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: "BOT BY AGUSS🔥" })
    .setTimestamp();

  // HELP
  if (cmd === "help") {
    embed.setTitle("📌 COMMAND LIST").setDescription(`
🔊 **Voice**
\`!join\` - Join VC
\`!leave\` - Stop auto join

🛠️ **Utility**
\`!ping\`
\`!say\`
\`!avatar\`

🔨 **Moderator**
\`!kick\`
\`!ban\`
\`!clear\`
\`!timeout\`
    `);

    return message.reply({ embeds: [embed] });
  }

  // JOIN
  if (cmd === "join") {
    if (!message.member.voice.channel) {
      embed.setDescription("❌ Masuk VC dulu!");
      return message.reply({ embeds: [embed] });
    }

    const channel = message.member.voice.channel;

    joinVC(message.guild, channel.id);

    const data = loadVoice();
    data[message.guild.id] = channel.id;
    saveVoice(data);

    embed.setDescription("✅ Join VC & auto save!");
    return message.reply({ embeds: [embed] });
  }

  // LEAVE
  if (cmd === "leave") {
    const data = loadVoice();
    delete data[message.guild.id];
    saveVoice(data);

    const conn = getVoiceConnection(message.guild.id);
    if (conn) conn.destroy();

    embed.setDescription("👋 Auto join dimatikan!");
    return message.reply({ embeds: [embed] });
  }

  // PING
  if (cmd === "ping") {
    embed.setDescription(`🏓 Pong! ${client.ws.ping}ms`);
    return message.reply({ embeds: [embed] });
  }

  // SAY
  if (cmd === "say") {
    const text = args.join(" ");
    if (!text) {
      embed.setDescription("❌ Tulis pesan!");
      return message.reply({ embeds: [embed] });
    }

    message.channel.send({ embeds: [embed.setDescription(text)] });
  }

  // AVATAR
  if (cmd === "avatar") {
    const user = message.mentions.users.first() || message.author;

    embed
      .setTitle(`Avatar ${user.username}`)
      .setImage(user.displayAvatarURL({ dynamic: true, size: 512 }));

    return message.reply({ embeds: [embed] });
  }

  // KICK
  if (cmd === "kick") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      embed.setDescription("❌ Ga punya izin!");
      return message.reply({ embeds: [embed] });
    }

    const user = message.mentions.members.first();
    if (!user) {
      embed.setDescription("❌ Tag orangnya!");
      return message.reply({ embeds: [embed] });
    }

    await user.kick();
    embed.setDescription(`👢 ${user.user.tag} di kick!`);
    message.channel.send({ embeds: [embed] });
  }

  // BAN
  if (cmd === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      embed.setDescription("❌ Ga punya izin!");
      return message.reply({ embeds: [embed] });
    }

    const user = message.mentions.members.first();
    if (!user) {
      embed.setDescription("❌ Tag orangnya!");
      return message.reply({ embeds: [embed] });
    }

    await user.ban();
    embed.setDescription(`🔨 ${user.user.tag} di ban!`);
    message.channel.send({ embeds: [embed] });
  }

  // CLEAR
  if (cmd === "clear") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      embed.setDescription("❌ Ga punya izin!");
      return message.reply({ embeds: [embed] });
    }

    const amount = parseInt(args[0]);
    if (!amount) {
      embed.setDescription("❌ Masukin jumlah!");
      return message.reply({ embeds: [embed] });
    }

    await message.channel.bulkDelete(amount, true);

    embed.setDescription(`🧹 Hapus ${amount} pesan`);
    message.channel.send({ embeds: [embed] })
      .then(m => setTimeout(() => m.delete(), 3000));
  }

  // TIMEOUT
  if (cmd === "timeout") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      embed.setDescription("❌ Ga punya izin!");
      return message.reply({ embeds: [embed] });
    }

    const user = message.mentions.members.first();
    const time = parseInt(args[1]);

    if (!user || !time) {
      embed.setDescription("❌ Format: !timeout @user 5");
      return message.reply({ embeds: [embed] });
    }

    await user.timeout(time * 60 * 1000);

    embed.setDescription(`⏳ ${user.user.tag} di mute ${time} menit`);
    message.channel.send({ embeds: [embed] });
  }
});

// =======================
// 🔐 LOGIN
// =======================
client.login(process.env.TOKEN);