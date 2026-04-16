require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  AuditLogEvent
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
const LOG_CHANNEL_ID = "ISI_CHANNEL_LOG_LU";

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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ]
});

// =======================
// 🔊 JOIN VC
// =======================
async function joinVC(guild, channelId) {
  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel) return;

    const existing = getVoiceConnection(guild.id);
    if (existing) return;

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false
    });

    connection.on("stateChange", (oldState, newState) => {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        setTimeout(() => joinVC(guild, channelId), 5000);
      }
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 5000);

  } catch {
    setTimeout(() => joinVC(guild, channelId), 5000);
  }
}

// =======================
// 🚀 READY
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
// 🔁 AUTO CHECK
// =======================
setInterval(() => {
  const data = loadVoice();

  for (const guildId in data) {
    const connection = getVoiceConnection(guildId);

    if (!connection) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

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

  if (cmd === "leave") {
    const data = loadVoice();
    delete data[message.guild.id];
    saveVoice(data);

    const conn = getVoiceConnection(message.guild.id);
    if (conn) conn.destroy();

    embed.setDescription("👋 Auto join dimatikan!");
    return message.reply({ embeds: [embed] });
  }

  if (cmd === "ping") {
    embed.setDescription(`🏓 Pong! ${client.ws.ping}ms`);
    return message.reply({ embeds: [embed] });
  }

  if (cmd === "say") {
    const text = args.join(" ");
    if (!text) {
      embed.setDescription("❌ Tulis pesan!");
      return message.reply({ embeds: [embed] });
    }

    message.channel.send({ embeds: [embed.setDescription(text)] });
  }

  if (cmd === "avatar") {
    const user = message.mentions.users.first() || message.author;

    embed
      .setTitle(`Avatar ${user.username}`)
      .setImage(user.displayAvatarURL({ dynamic: true, size: 512 }));

    return message.reply({ embeds: [embed] });
  }

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
// 📊 AUDIT LOG SYSTEM
// =======================
function logEmbed(title, desc, color, user) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(desc)
    .setThumbnail(user?.displayAvatarURL?.({ dynamic: true }))
    .setFooter({ text: "BETLEHEM SYSTEM" })
    .setTimestamp();
}

function getLog(guild) {
  return guild.channels.cache.get(LOG_CHANNEL_ID);
}

client.on("guildMemberAdd", m => {
  const ch = getLog(m.guild); if (!ch) return;
  ch.send({ embeds: [logEmbed("🟢 JOIN", `${m.user.tag} masuk server`, "Green", m.user)] });
});

client.on("guildMemberRemove", async m => {
  const ch = getLog(m.guild); if (!ch) return;

  let text = "keluar server";

  try {
    const logs = await m.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
    const log = logs.entries.first();
    if (log && log.target.id === m.id) text = `di kick oleh ${log.executor.tag}`;
  } catch {}

  ch.send({ embeds: [logEmbed("🔴 LEAVE", `${m.user.tag} ${text}`, "Red", m.user)] });
});

client.on("messageDelete", m => {
  if (!m.guild || m.author?.bot) return;
  const ch = getLog(m.guild); if (!ch) return;

  ch.send({ embeds: [logEmbed("🗑 DELETE", `${m.author.tag}\n${m.content || "-"}`, "DarkRed", m.author)] });
});

client.on("messageUpdate", (o, n) => {
  if (!o.guild || o.author?.bot) return;
  if (o.content === n.content) return;

  const ch = getLog(o.guild); if (!ch) return;

  ch.send({
    embeds: [logEmbed("✏️ EDIT",
      `User: ${o.author.tag}\nBefore: ${o.content || "-"}\nAfter: ${n.content || "-"}`,
      "Yellow", o.author)]
  });
});

client.on("voiceStateUpdate", (o, n) => {
  const ch = getLog(n.guild); if (!ch) return;

  let txt;
  if (!o.channel && n.channel) txt = `join ${n.channel}`;
  else if (o.channel && !n.channel) txt = `leave ${o.channel}`;
  else if (o.channelId !== n.channelId) txt = `move ${o.channel} ➜ ${n.channel}`;
  else return;

  ch.send({ embeds: [logEmbed("🔊 VOICE", `${n.member.user.tag} ${txt}`, "Blue", n.member.user)] });
});

client.on("guildMemberUpdate", (o, n) => {
  const ch = getLog(n.guild); if (!ch) return;

  const add = n.roles.cache.filter(r => !o.roles.cache.has(r.id));
  const rem = o.roles.cache.filter(r => !n.roles.cache.has(r.id));

  if (!add.size && !rem.size) return;

  ch.send({
    embeds: [logEmbed("🎭 ROLE",
      `${n.user.tag}\n+ ${add.map(r => r.name).join(", ") || "-"}\n- ${rem.map(r => r.name).join(", ") || "-"}`,
      "Purple", n.user)]
  });
});

client.on("guildBanAdd", async b => {
  const ch = getLog(b.guild); if (!ch) return;

  let exec = "Unknown";

  try {
    const logs = await b.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
    const log = logs.entries.first();
    if (log) exec = log.executor.tag;
  } catch {}

  ch.send({ embeds: [logEmbed("🔨 BAN", `${b.user.tag} oleh ${exec}`, "Red", b.user)] });
});

client.on("inviteCreate", i => {
  const ch = getLog(i.guild); if (!ch) return;

  ch.send({
    embeds: [logEmbed("🔗 INVITE",
      `${i.inviter.tag}\n${i.channel}\nhttps://discord.gg/${i.code}`,
      "Aqua", i.inviter)]
  });
});

// =======================
// 🔐 LOGIN
// =======================
client.login(process.env.TOKEN);
