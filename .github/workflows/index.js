const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

const spamMap = new Map();
const nukeTracking = new Map();

// Security Configuration Thresholds
const SPAM_LIMIT = 5; 
const TIME_WINDOW = 3000; 
const NUKE_THRESHOLD = 3; 
const NUKE_WINDOW = 10000; 

client.once('ready', () => {
    console.log(`🛡️ Olympus Security Online. Logged in as ${client.user.tag}`);
});

// MODULE 1: ANTI-SPAM
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const currentTime = Date.now();

    if (!spamMap.has(userId)) {
        spamMap.set(userId, { count: 1, lastMessage: currentTime });
    } else {
        const data = spamMap.get(userId);
        if (currentTime - data.lastMessage < TIME_WINDOW) {
            data.count++;
            if (data.count >= SPAM_LIMIT) {
                try {
                    const member = await message.guild.members.fetch(userId);
                    if (member.manageable) {
                        await member.timeout(300000, 'Automated Anti-Spam Lockdown');
                        await message.channel.send(`⚠️ **Anti-Spam:** ${message.author} has been muted for 5 minutes.`);
                    }
                } catch (err) {
                    console.error('Anti-spam action failed:', err);
                }
                spamMap.delete(userId);
                return;
            }
        } else {
            data.count = 1;
        }
        data.lastMessage = currentTime;
        spamMap.set(userId, data);
    }
});

// MODULE 2: ANTI-NUKE (Channel Deletions)
client.on('channelDelete', async (channel) => {
    const guild = channel.guild;
    const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 12 });
    const entry = auditLogs.entries.first();
    if (!entry) return;

    const executorId = entry.executor.id;
    if (executorId === client.user.id || executorId === guild.ownerId) return;

    handleNukeThreat(guild, executorId, `Mass Channel Deletion`);
});

// MODULE 3: ANTI-NUKE (Mass Bans)
client.on('guildBanAdd', async (ban) => {
    const guild = ban.guild;
    const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 22 });
    const entry = auditLogs.entries.first();
    if (!entry) return;

    const executorId = entry.executor.id;
    if (executorId === client.user.id || executorId === guild.ownerId) return;

    handleNukeThreat(guild, executorId, `Mass Member Banning`);
});

// Core Mitigation Logic
async function handleNukeThreat(guild, userId, reason) {
    const now = Date.now();
    if (!nukeTracking.has(userId)) {
        nukeTracking.set(userId, { count: 1, time: now });
        return;
    }

    const userData = nukeTracking.get(userId);
    if (now - userData.time < NUKE_WINDOW) {
        userData.count++;
        if (userData.count >= NUKE_THRESHOLD) {
            try {
                const targetMember = await guild.members.fetch(userId);
                if (targetMember.manageable) {
                    await targetMember.roles.set([], 'Olympus Anti-Nuke Lockdown Triggered');
                    if (targetMember.bannable) {
                        await targetMember.ban({ reason: `Olympus Anti-Nuke: Rogue administrator activity detected.` });
                    }
                    console.log(`🚨 Rogue user neutralized: ${userId}`);
                }
            } catch (err) {
                console.error('Containment routine failed:', err);
            }
            nukeTracking.delete(userId);
        } else {
            nukeTracking.set(userId, userData);
        }
    } else {
        nukeTracking.set(userId, { count: 1, time: now });
    }
}

client.login(process.env.DISCORD_TOKEN);
