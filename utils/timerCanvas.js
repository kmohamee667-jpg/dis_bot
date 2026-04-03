const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Register Cairo Fonts for better cloud host support (supports Arabic/English)
try {
    GlobalFonts.registerFromPath(path.join(__dirname, '../fonts/Cairo-Bold.ttf'), 'Cairo');
    GlobalFonts.registerFromPath(path.join(__dirname, '../fonts/Cairo-Regular.ttf'), 'Cairo');
} catch (e) {
    console.error('Warning: Cairo fonts not found in /fonts/ directory. Falling back to system fonts.');
}

/**
 * Draw the dynamic timer image (LANDSCAPE REDESIGN)
 * 
 * @param {object} timerData - Current state from TimerManager
 * @param {object} themeData - Metadata from themes.json
 */
async function drawTimer(timerData, themeData = {}) {
    const width = 1200;
    const height = 700;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 0. Fallback for themeData if undefined to prevent crash
    const mainColor = themeData.color || '#00f2ff';
    const circleColor = themeData.circleColor || '#ff00ff';
    const bgPath = themeData.path ? path.join(__dirname, '../', themeData.path) : null;

    // 1. Draw Background + Dark Overlay
    if (bgPath) {
        try {
            const bg = await loadImage(bgPath);
            const hRatio = canvas.width / bg.width;
            const vRatio = canvas.height / bg.height;
            const ratio = Math.max(hRatio, vRatio);
            const centerShiftX = (canvas.width - bg.width * ratio) / 2;
            const centerShiftY = (canvas.height - bg.height * ratio) / 2;
            ctx.drawImage(bg, 0, 0, bg.width, bg.height, centerShiftX, centerShiftY, bg.width * ratio, bg.height * ratio);
        } catch (e) {
            ctx.fillStyle = '#0f0f1f';
            ctx.fillRect(0, 0, width, height);
        }
    } else {
        ctx.fillStyle = '#0f0f1f';
        ctx.fillRect(0, 0, width, height);
    }

    // Add Dark TINT over the whole background for readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, height);

    // 2. LEFT SIDE: Member Participation List (PURPLE AREA)
    const listWidth = 450;
    const listX = 40;
    const listY = 40;
    const listHeight = height - 80;

    // Draw the purple glassmorphism box
    ctx.fillStyle = 'rgba(103, 58, 183, 0.25)'; // Semi-transparent Purple
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    roundRect(ctx, listX, listY, listWidth, listHeight, 20, true, true);

    // Header for members
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Cairo';
    ctx.textAlign = 'left';
    ctx.fillText('👥 Active members', listX + 25, listY + 50);

    // Display Members (3-Column Grid - SORTED)
    const sortedParticipants = Object.entries(timerData.participants)
        .sort(([, timeA], [, timeB]) => timeB - timeA);

    const colCount = 3;
    const itemHeight = 60;
    const itemWidth = (listWidth - 40) / colCount;   // ≈ 136px per item
    const maxItems = 24;                              // 3 cols × 8 rows
    const avatarRadius = 13;                          // smaller to fit 3 cols

    ctx.font = 'bold 14px Cairo';
    for (let i = 0; i < Math.min(sortedParticipants.length, maxItems); i++) {
        const [userId, totalSeconds] = sortedParticipants[i];
        const participantName = timerData.participantNames[userId] || `User ${userId.slice(0, 5)}`;
        const isActive = timerData.currentParticipants.has(userId);
        const avatarUrl = timerData.participantAvatars && timerData.participantAvatars[userId]
            ? timerData.participantAvatars[userId]
            : null;

        const row = Math.floor(i / colCount);
        const col = i % colCount;

        const itemX = listX + 15 + col * itemWidth;
        const itemY = listY + 80 + row * itemHeight;

        // Uniform style for all members
        const borderColor = isActive ? '#2ecc71' : 'rgba(255, 255, 255, 0.3)';
        const pillBg = 'rgba(0, 0, 0, 0.4)';
        const lineWidth = 1.5;

        // Draw the Member "Pill"
        ctx.fillStyle = pillBg;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = lineWidth;
        roundRect(ctx, itemX + 3, itemY, itemWidth - 6, 48, 24, true, true);

        // Circular Avatar
        const avatarX = itemX + avatarRadius + 7;
        const avatarY = itemY + 24;
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
        ctx.clip();

        let avatarLoaded = false;
        if (avatarUrl) {
            try {
                const avatarImg = await loadImage(avatarUrl);
                ctx.drawImage(avatarImg, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
                avatarLoaded = true;
            } catch (e) {}
        }
        if (!avatarLoaded) {
            ctx.fillStyle = circleColor;
            ctx.fill();
        }
        ctx.restore();



        // Name
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.font = `bold 12px Cairo`;
        const truncatedName = participantName.length > 6 ? participantName.slice(0, 5) + '..' : participantName;
        ctx.fillText(truncatedName, avatarX + avatarRadius + 3, itemY + 18);

        // Time
        const pMins = Math.floor(totalSeconds / 60);
        const pSecs = totalSeconds % 60;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '10px Cairo';
        ctx.fillText(`${pMins}m ${pSecs}s`, avatarX + avatarRadius + 3, itemY + 33);

        // Active dot - for ALL active users
        if (isActive) {
            ctx.beginPath();
            ctx.arc(avatarX + avatarRadius - 3, avatarY + avatarRadius - 3, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#2ecc71';
            ctx.fill();
        }
    }

    if (sortedParticipants.length > maxItems) {
        ctx.fillStyle = '#aaaaaa';
        ctx.textAlign = 'center';
        ctx.font = '14px Cairo';
        ctx.fillText(`+ ${sortedParticipants.length - maxItems} more..`, listX + listWidth / 2, listY + listHeight - 20);
    }

    // 3. RIGHT SIDE: TIMER CIRCLE
    const timerCenterX = 850;
    const timerCenterY = height / 2;
    const timerRadius = 240;

    // Progress Arc
    const startAngle = -Math.PI / 2;
    const progress = Math.max(0, timerData.timeLeft / timerData.totalTime);
    const endAngle = startAngle + (Math.PI * 2 * progress);

    // Outer Circle Track
    ctx.beginPath();
    ctx.arc(timerCenterX, timerCenterY, timerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 30;
    ctx.stroke();

    // Actual Progress Arc
    ctx.beginPath();
    ctx.arc(timerCenterX, timerCenterY, timerRadius, startAngle, endAngle);
    ctx.strokeStyle = circleColor;
    ctx.lineWidth = 32;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Glow Effect
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = circleColor;
    ctx.stroke();
    ctx.restore();

    // Central Time Text
    const minutes = Math.floor(timerData.timeLeft / 60);
    const seconds = Math.floor(timerData.timeLeft % 60);
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 130px Cairo'; // Larger text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, timerCenterX, timerCenterY - 20);

    // Mode Title
    ctx.font = 'bold 36px Cairo';
    ctx.fillStyle = circleColor;
    const modeStr = timerData.mode === 'study' ? '📖 STUDYING' : '☕ BREAKING';
    ctx.fillText(modeStr, timerCenterX, timerCenterY + 85);

    // INFO BLOCS (Metadata around circle)
    // Starter Info
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Cairo';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(`Starter: ${timerData.starterName || 'System'}`, timerCenterX, timerCenterY - 220);
    
    // Cycle & Theme Info
    ctx.font = 'italic 18px Cairo';
    ctx.fillText(`Cycle ${timerData.currentCycle}/${timerData.totalCycles} | Theme: ${themeData.name || 'Default'}`, timerCenterX, timerCenterY + 130);

    return canvas.toBuffer('image/png');
}

/**
 * Helper to draw rounded rectangles
 */
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof radius === 'number') {
        radius = { tl: radius, tr: radius, br: radius, bl: radius };
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

async function drawLeaderboard(topUsers, guildMembers, guildId) {
    // Responsive height
    const width = 1200;
    const baseHeight = 900;
    const extraUsers = Math.max(0, topUsers.length - 10);
    const height = baseHeight + extraUsers * 70;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0f0f1f';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 48px Cairo';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆 Leaderboard - أكثر وقت دراسة', width / 2, 60);

    // Podium circles (LOWER + custom positions)
    const podiumY = 280;
    const circleRadius = 140;
    const podiumConfigs = [
        { color: 'rgba(255, 215, 0, 0.4)', stroke: '#FFD700', lineWidth: 8, icon: '👑', label: 'الأول' },
        { color: 'rgba(192, 192, 192, 0.4)', stroke: '#C0C0C0', lineWidth: 6, icon: '🥈', label: 'الثاني' },
        { color: 'rgba(205, 127, 50, 0.4)', stroke: '#CD7F32', lineWidth: 6, icon: '🥉', label: 'الثالث' }
    ];

    // Position 1: Center, HIGHER
    if (topUsers[0]) {
        const config = podiumConfigs[0];
        const centerX = width / 2;
        const pos1Y = podiumY - 50;  // Higher
        // Circle bg
        ctx.fillStyle = config.color;
        ctx.beginPath();
        ctx.arc(centerX, pos1Y, circleRadius, 0, Math.PI * 2);
        ctx.fill();
        // Border
        ctx.strokeStyle = config.stroke;
        ctx.lineWidth = config.lineWidth;
        ctx.shadowBlur = 15;
        ctx.shadowColor = config.stroke;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Icon
        ctx.font = 'bold 60px Cairo';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(config.icon, centerX, pos1Y - circleRadius - 30);
        // Avatar & text below (same logic)
        const user = topUsers[0];
        const member = guildMembers.get(user.userId);
        const avatarUrl = member ? member.user.displayAvatarURL({ extension: 'png', size: 256 }) : null;
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, pos1Y, circleRadius - 30, 0, Math.PI * 2);
        ctx.clip();
        if (avatarUrl) {
            try {
                const avatarImg = await loadImage(avatarUrl);
                ctx.drawImage(avatarImg, centerX - (circleRadius - 30), pos1Y - (circleRadius - 30), (circleRadius - 30)*2, (circleRadius - 30)*2);
            } catch (e) { ctx.fillStyle = '#666'; ctx.fill(); }
        } else { ctx.fillStyle = '#666'; ctx.fill(); }
        ctx.restore();
        // Name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Cairo';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(member ? member.displayName : user.userId.slice(0,8), centerX, pos1Y + circleRadius + 40);
        ctx.font = 'bold 24px Cairo';
        ctx.fillStyle = '#FFD700';
        const mins1 = Math.floor(user.seconds / 60);
        ctx.fillText(`${mins1}m`, centerX, pos1Y + circleRadius + 80);
    }

    // Pos2 Left, Pos3 Right (same line)
    for (let rank = 1; rank < 3; rank++) {
        if (!topUsers[rank]) break;
        const config = podiumConfigs[rank];
        const centerX = rank === 1 ? 350 : 850;  // Left & Right
        const centerY = podiumY;  // Same line
        // Circle bg
        ctx.fillStyle = config.color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
        ctx.fill();
        // Border + rest same as pos1...
        ctx.strokeStyle = config.stroke;
        ctx.lineWidth = config.lineWidth;
        ctx.shadowBlur = 15;
        ctx.shadowColor = config.stroke;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.font = 'bold 60px Cairo';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(config.icon, centerX, centerY - circleRadius - 30);
        const user = topUsers[rank];
        const member = guildMembers.get(user.userId);
        const avatarUrl = member ? member.user.displayAvatarURL({ extension: 'png', size: 256 }) : null;
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, circleRadius - 30, 0, Math.PI * 2);
        ctx.clip();
        if (avatarUrl) {
            try {
                const avatarImg = await loadImage(avatarUrl);
                ctx.drawImage(avatarImg, centerX - (circleRadius - 30), centerY - (circleRadius - 30), (circleRadius - 30)*2, (circleRadius - 30)*2);
            } catch (e) { ctx.fillStyle = '#666'; ctx.fill(); }
        } else { ctx.fillStyle = '#666'; ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Cairo';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(member ? member.displayName : user.userId.slice(0,8), centerX, centerY + circleRadius + 40);
        ctx.font = 'bold 24px Cairo';
        ctx.fillStyle = config.stroke;
        const mins = Math.floor(user.seconds / 60);
        ctx.fillText(`${mins}m`, centerX, centerY + circleRadius + 80);
    }

    // Rest of leaderboard - vertical list
    ctx.textAlign = 'left';
    const listStartY = podiumY + circleRadius + 150;
    const itemHeight = 70;
    const avatarR = 30;
    const startRank = 4;

    for (let i = 0; i < topUsers.slice(3).length && listStartY + i * itemHeight < height - 50; i++) {
        const user = topUsers[startRank - 1 + i];
        const y = listStartY + i * itemHeight;
        const member = guildMembers.get(user.userId);

        // Pill background
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, 100, y - 10, width - 200, itemHeight - 20, 25, true, false);

        // Rank number
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 32px Cairo';
        ctx.textAlign = 'center';
        ctx.fillText(`${startRank + i}`, 80, y + 5);

        // Avatar
        const avX = 150;
        const avY = y;
        ctx.save();
        ctx.beginPath();
        ctx.arc(avX, avY, avatarR, 0, Math.PI * 2);
        ctx.clip();
        const avUrl = member ? member.user.displayAvatarURL({ extension: 'png', size: 128 }) : null;
        if (avUrl) {
            try {
                const avImg = await loadImage(avUrl);
                ctx.drawImage(avImg, avX - avatarR, avY - avatarR, avatarR*2, avatarR*2);
            } catch {}
        } else {
            ctx.fillStyle = '#888';
            ctx.fill();
        }
        ctx.restore();

        // Name & Time
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Cairo';
        ctx.fillText(member ? member.displayName : user.userId.slice(0,12), avX + avatarR + 20, y + 8);

        ctx.font = '20px Cairo';
        ctx.fillStyle = '#cccccc';
        const totalMins = Math.floor(user.seconds / 60);
        ctx.fillText(`${totalMins}m`, avX + avatarR + 20, y + 40);
    }

    return canvas.toBuffer('image/png');
}

module.exports = { drawTimer, drawLeaderboard };

