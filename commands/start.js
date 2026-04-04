const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const timerManager = require('../utils/timerManager');
const { validateGuild } = require('../utils/guildValidator');
const { drawTimer, drawLeaderboard } = require('../utils/timerCanvas');
const { getThemeChoices } = require('../utils/themesDb');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start')
        .setDescription('بدأ تايمر المذاكرة (Pomodoro)')
        .addIntegerOption(option =>
            option.setName('study_time')
                .setDescription('وقت الدراسة بالدقائق')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('break_time')
                .setDescription('وقت البريك بالدقائق')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('cycles')
                .setDescription('عدد الدورات (دراسة + بريك)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('theme')
                .setDescription('اختر ثيم التايمر')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('update_mode')
                .setDescription('طريقة تحديث التايمر (الاختيار التلقائي: تحديث نفس الرسالة)')
                .addChoices(
                    { name: 'تحديث نفس الرسالة (Default)', value: 'edit' },
                    { name: 'إرسال رسالة جديدة', value: 'new' }
                )),

    async execute(interaction) {
        // ✅ التحقق من Guild ID
        if (!await validateGuild(interaction)) return;

        const studyTime = interaction.options.getInteger('study_time');
        const breakTime = interaction.options.getInteger('break_time');
        const totalCycles = interaction.options.getInteger('cycles');
        const themeKey = interaction.options.getString('theme');
        const updateMode = interaction.options.getString('update_mode') || 'edit';
        const themeDb = require('../utils/themesDb');
        const theme = await themeDb.getTheme(themeKey) || {};


        // 1. Validation
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return await interaction.reply({ content: '❌ يجب أن تكون في غرفة صوتية لتبدأ التايمر!', flags: [MessageFlags.Ephemeral] });
        }

        if (timerManager.hasTimer(voiceChannel.id)) {
            return await interaction.reply({ content: '⚠️ هناك تايمر يعمل بالفعل في هذه الغرفة!', flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferReply();

        // 2. Initial Setup
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
            updateMode: updateMode,
            currentCycle: 1,
            totalCycles: totalCycles,
            themeKey: themeKey,
            participantNames: {},
            participantAvatars: {},
            currentParticipants: new Set(),
            messageId: null,
            startTime: Date.now(),
            status: 'running'
        };

        voiceChannel.members.forEach(member => {
            if (member.user.bot) return;
            timerData.participantNames[member.id] = member.displayName || member.user.username;
            timerData.participantAvatars[member.id] = member.user.displayAvatarURL({ extension: 'png', size: 128 });
            timerData.currentParticipants.add(member.id);
        });

        timerManager.startTimer(voiceChannel.id, timerData);

        // 3. Initial Render
        await interaction.reply({ content: '⏳ جاري بدء التسايمر...', flags: [MessageFlags.Ephemeral] });
        await timerManager.refreshTimerMessage(interaction.client, voiceChannel.id);
    },
};
