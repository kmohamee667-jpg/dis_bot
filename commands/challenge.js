const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const timerManager = require('../utils/timerManager');
const { validateGuild } = require('../utils/guildValidator');
const { drawTimer } = require('../utils/timerCanvas');
const { getThemeChoices } = require('../utils/themesDb');
const { isAdmin } = require('../utils/admin-check');

const CHALLENGE_SUMMARY_CHANNEL = '1487708777678635048';

function formatMentions(rank) {
    if (!rank || rank.length === 0) return '*لا يوجد مشاركين حتى الآن*';
    return rank.map((item, idx) => `**${idx + 1}.** <@${item.userId}> - \`${Math.floor(item.seconds / 60)}m ${item.seconds % 60}s\``).join('\n');
}

async function updateChallengeSummary(client, timer, cycleDoneInfo = null, final = false) {
    const channel = client.channels.cache.get(CHALLENGE_SUMMARY_CHANNEL) || await client.channels.fetch(CHALLENGE_SUMMARY_CHANNEL).catch(() => null);
    if (!channel) return;

    const totalParticipants = Object.keys(timer.participants || {}).length;
    const overallSorted = Object.entries(timer.participants || {})
        .map(([userId, seconds]) => ({ userId, seconds }))
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 3);

    const currentCycle = timer.currentCycle;
    const totalCycles = timer.totalCycles;

    const cycleTitle = !cycleDoneInfo ? 'بدء التحدي' : `انتهت دورة ${cycleDoneInfo.cycle}`;
    const cycleLeaders = cycleDoneInfo ? cycleDoneInfo.cycleLeaders : [];

    const embed = new EmbedBuilder()
        .setTitle(final ? '🏁 نتائج التحدي النهائي' : `📣 تقرير تحدي غرفة <#${timer.channelId}>`)
        .setDescription(`
**الحالة:** ${final ? 'تم الانتهاء من التحدي' : `${currentCycle}/${totalCycles} دورة`}
**المشاركون الكليين:** ${totalParticipants}
${cycleDoneInfo ? `**أقوى دورة:** ${cycleDoneInfo.cycle}` : ''}
        `)
        .setColor(final ? '#2ECC71' : '#9B59B6')
        .addFields(
            { name: '🥇 أفضل 3 في هذه الدورة', value: formatMentions(cycleLeaders) || 'لا بيانات', inline: false },
            { name: '🏆 ترتيب عام (أعلى 3)', value: formatMentions(overallSorted) || 'لا بيانات', inline: false }
        )
        .setFooter({ text: 'تحدي الوقت • تحديث كل دورة تلقائي', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    // image placeholder for top scorers
    embed.setImage(`https://via.placeholder.com/700x200.png?text=${encodeURIComponent(final ? 'Final+Champion' : `Cycle+${currentCycle}`)}`);

    if (timer.challengeSummaryMessageId) {
        const existingMsg = await channel.messages.fetch(timer.challengeSummaryMessageId).catch(() => null);
        if (existingMsg) {
            return await existingMsg.edit({ embeds: [embed] }).catch(() => null);
        }
    }

    const newMsg = await channel.send({ embeds: [embed] }).catch(() => null);
    if (newMsg) timer.challengeSummaryMessageId = newMsg.id;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('challenge')
        .setDescription('ابدأ تحدي مذاكرة دوري (سلسلة + إمكانية استكمال يدوي)')
        .addIntegerOption(option => option.setName('study_time').setDescription('وقت الدراسة بالدقائق').setRequired(true))
        .addIntegerOption(option => option.setName('break_time').setDescription('وقت البريك بالدقائق').setRequired(true))
        .addIntegerOption(option => option.setName('cycles').setDescription('عدد الدورات (دراسة + بريك)').setRequired(true))
        .addStringOption(option =>
            option.setName('theme')
                .setDescription('اختر ثيم التايمر')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option => option.setName('cycle_mode').setDescription('وضع السايكل').setRequired(true).addChoices({ name: 'تشغيل متواصل', value: 'auto' }, { name: 'انتظار استكمال يدوي', value: 'manual' }))
        .addStringOption(option => option.setName('update_mode').setDescription('طريقة تحديث رسالة التايمر').addChoices({ name: 'تحديث نفس الرسالة', value: 'edit' }, { name: 'إرسال رسالة جديدة', value: 'new' }))
        .addStringOption(option => option.setName('top3_prize').setDescription('جائزة التوب 3 (كوينز أو رول)'))
        .addStringOption(option => option.setName('top10_prize').setDescription('جائزة التوب 10 (كوينز أو رول)')),


    async execute(interaction) {
        // ✅ التحقق من Guild ID
        if (!await validateGuild(interaction)) return;

        if (!isAdmin(interaction, 'challenge')) {
            return await interaction.reply({ content: '❌ ليس لديك صلاحية استخدام هذا الأمر.', flags: [MessageFlags.Ephemeral] });
        }

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return await interaction.reply({ content: '❌ يجب أن تكون في غرفة صوتية لتبدأ التحدي.', flags: [MessageFlags.Ephemeral] });
        }

        if (timerManager.hasTimer(voiceChannel.id)) {
            return await interaction.reply({ content: '⚠️ هناك تحدي/تايمر يعمل حاليًا في هذه الغرفة.', flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const studyTime = interaction.options.getInteger('study_time');
        const breakTime = interaction.options.getInteger('break_time');
        const totalCycles = interaction.options.getInteger('cycles');
        const themeKey = interaction.options.getString('theme');
        const updateMode = interaction.options.getString('update_mode') || 'edit';
        const cycleMode = interaction.options.getString('cycle_mode') || 'auto';
        const top3_prize = interaction.options.getString('top3_prize');
        const top10_prize = interaction.options.getString('top10_prize');

        const timerData = {
            guildId: interaction.guildId,
            channelId: voiceChannel.id,
            textChannelId: interaction.channelId,
            starterId: interaction.user.id,
            starterName: interaction.member.displayName || interaction.user.username,
            studyTime: studyTime * 60,
            breakTime: breakTime * 60,
            totalTime: studyTime * 60,
            timeLeft: studyTime * 60,
            mode: 'study',
            status: 'running',
            updateMode,
            currentCycle: 1,
            totalCycles,
            themeKey,
            cycleMode,
            top3_prize,
            top10_prize,
            isChallenge: true,
            waitingContinue: false,
            challengeSummaryMessageId: null,
            participantNames: {},
            participantAvatars: {},
            currentParticipants: new Set(),
            messageId: null,
            startTime: Date.now()
        };

        voiceChannel.members.forEach(member => {
            if (member.user.bot) return;
            timerData.participantNames[member.id] = member.displayName || member.user.username;
            timerData.participantAvatars[member.id] = member.user.displayAvatarURL({ extension: 'png', size: 128 });
            timerData.currentParticipants.add(member.id);
        });

        timerManager.startTimer(voiceChannel.id, timerData);

        await interaction.editReply({ content: '🚀 تم بدء التحدي بنجاح! سيتم توزيع الجوائز فور الانتهاء.' });
        
        // Initial render and summary
        await timerManager.refreshTimerMessage(interaction.client, voiceChannel.id);
        await updateChallengeSummary(interaction.client, timerData, null, false);
    }
};