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

async function drawLeaderboard(topUsers, guildMembers, guildId, currentUserId = null) {
    // Responsive height
    const width = 1200;
    const baseHeight = 950;
    const extraUsers = Math.max(0, topUsers.length - 10);
    const height = baseHeight + extraUsers * 65;
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

    // ===== TOP 3 CONTAINER =====
    const topContainerX = 50;
    const topContainerY = 120;
    const topContainerWidth = width - 100;
    const topContainerHeight = 320;

    // Draw top 3 container with purple bg and bottom-only border radius
    ctx.fillStyle = 'rgba(103, 58, 183, 0.25)';
    roundRectCustom(ctx, topContainerX, topContainerY, topContainerWidth, topContainerHeight, { tl: 0, tr: 0, br: 25, bl: 25 }, true, false);
    
    // Border for top 3 container
    ctx.strokeStyle = 'rgba(147, 112, 219, 0.6)';
    ctx.lineWidth = 2;
    roundRectCustom(ctx, topContainerX, topContainerY, topContainerWidth, topContainerHeight, { tl: 0, tr: 0, br: 25, bl: 25 }, false, true);

    // Draw top 3 with spacing
    const podiumConfigs = [
        { color: 'rgba(255, 215, 0, 0.4)', stroke: '#FFD700', lineWidth: 8, icon: '👑' },
        { color: 'rgba(192, 192, 192, 0.4)', stroke: '#C0C0C0', lineWidth: 6, icon: '🥈' },
        { color: 'rgba(205, 127, 50, 0.4)', stroke: '#CD7F32', lineWidth: 6, icon: '🥉' }
    ];

    const circleRadius = 90;
    const top3StartX = 80;
    const spacingX = (topContainerWidth - 160) / 2;  // Spread circles with spacing
    const top3Y = topContainerY + 90;

    for (let rank = 0; rank < 3; rank++) {
        if (!topUsers[rank]) continue;
        const config = podiumConfigs[rank];
        const centerX = top3StartX + rank * (circleRadius * 2 + spacingX);
        
        // Circle bg
        ctx.fillStyle = config.color;
        ctx.beginPath();
        ctx.arc(centerX, top3Y, circleRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Border with glow
        ctx.strokeStyle = config.stroke;
        ctx.lineWidth = config.lineWidth;
        ctx.shadowBlur = 15;
        ctx.shadowColor = config.stroke;
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Icon above
        ctx.font = 'bold 50px Cairo';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(config.icon, centerX, top3Y - circleRadius - 20);
        
        // Avatar inside circle
        const user = topUsers[rank];
        const member = guildMembers.get(user.userId);
        const avatarUrl = member ? member.user.displayAvatarURL({ extension: 'png', size: 256 }) : null;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, top3Y, circleRadius - 20, 0, Math.PI * 2);
        ctx.clip();
        
        if (avatarUrl) {
            try {
                const avatarImg = await loadImage(avatarUrl);
                ctx.drawImage(avatarImg, centerX - (circleRadius - 20), top3Y - (circleRadius - 20), (circleRadius - 20) * 2, (circleRadius - 20) * 2);
            } catch (e) { ctx.fillStyle = '#666'; ctx.fill(); }
        } else { ctx.fillStyle = '#666'; ctx.fill(); }
        ctx.restore();
        
        // Name below circle
        const isCurrentUser = currentUserId && user.userId === currentUserId;
        ctx.fillStyle = isCurrentUser ? '#00FF00' : '#ffffff';
        ctx.font = isCurrentUser ? 'bold 22px Cairo' : 'bold 20px Cairo';
        ctx.textAlign = 'center';
        ctx.fillText(member ? member.displayName : user.userId.slice(0, 8), centerX, top3Y + circleRadius + 30);
        
        // Time below name
        ctx.font = 'bold 18px Cairo';
        ctx.fillStyle = config.stroke;
        const mins = Math.floor(user.seconds / 60);
        ctx.fillText(`${mins}m`, centerX, top3Y + circleRadius + 60);
    }

    // ===== REST OF USERS CONTAINER =====
    const restContainerX = 50;
    const restContainerY = topContainerY + topContainerHeight + 30;
    const restContainerWidth = width - 100;
    const itemHeight = 65;
    const numRestUsers = topUsers.length - 3;
    const restContainerHeight = Math.max(numRestUsers * itemHeight + 30, 100);

    // Draw rest container with purple bg and top-only border radius
    ctx.fillStyle = 'rgba(103, 58, 183, 0.15)';
    roundRectCustom(ctx, restContainerX, restContainerY, restContainerWidth, restContainerHeight, { tl: 25, tr: 25, br: 0, bl: 0 }, true, false);
    
    // Border for rest container
    ctx.strokeStyle = 'rgba(147, 112, 219, 0.4)';
    ctx.lineWidth = 2;
    roundRectCustom(ctx, restContainerX, restContainerY, restContainerWidth, restContainerHeight, { tl: 25, tr: 25, br: 0, bl: 0 }, false, true);

    // Draw remaining users
    for (let i = 3; i < topUsers.length && restContainerY + (i - 3) * itemHeight < height - 30; i++) {
        const user = topUsers[i];
        const y = restContainerY + (i - 3) * itemHeight + 15;
        const member = guildMembers.get(user.userId);
        const isCurrentUser = currentUserId && user.userId === currentUserId;

        // Item background (darker for name area)
        const itemBg = isCurrentUser ? 'rgba(0, 255, 0, 0.1)' : 'rgba(0, 0, 0, 0.3)';
        ctx.fillStyle = itemBg;
        roundRect(ctx, restContainerX + 15, y - 5, restContainerWidth - 30, itemHeight - 10, 15, true, false);

        // Rank number
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 24px Cairo';
        ctx.textAlign = 'left';
        ctx.fillText(`${i + 1}`, restContainerX + 30, y + 18);

        // Avatar (small circular)
        const avX = restContainerX + 90;
        const avY = y + 10;
        const avRadius = 16;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(avX, avY, avRadius, 0, Math.PI * 2);
        ctx.clip();
        
        const avUrl = member ? member.user.displayAvatarURL({ extension: 'png', size: 128 }) : null;
        if (avUrl) {
            try {
                const avImg = await loadImage(avUrl);
                ctx.drawImage(avImg, avX - avRadius, avY - avRadius, avRadius * 2, avRadius * 2);
            } catch {}
        } else {
            ctx.fillStyle = '#888';
            ctx.fill();
        }
        ctx.restore();

        // Name with dark background
        const nameX = avX + avRadius + 15;
        const nameWidth = 250;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        roundRect(ctx, nameX - 5, y, nameWidth, 35, 8, true, false);

        ctx.textAlign = 'left';
        ctx.fillStyle = isCurrentUser ? '#00FF00' : '#ffffff';
        ctx.font = isCurrentUser ? 'bold 18px Cairo' : 'bold 16px Cairo';
        ctx.fillText(member ? member.displayName : user.userId.slice(0, 12), nameX + 5, y + 22);

        // Time on the right
        ctx.textAlign = 'right';
        ctx.fillStyle = '#cccccc';
        ctx.font = 'bold 16px Cairo';
        const totalMins = Math.floor(user.seconds / 60);
        const totalSecs = user.seconds % 60;
        ctx.fillText(`${totalMins}m ${totalSecs}s`, restContainerX + restContainerWidth - 30, y + 22);
    }

    return canvas.toBuffer('image/png');
}

/**
 * Helper to draw rounded rectangles with custom radius for each corner
 */
function roundRectCustom(ctx, x, y, width, height, radius, fill, stroke) {
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

module.exports = { drawTimer, drawLeaderboard };

