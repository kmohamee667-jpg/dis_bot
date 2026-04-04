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
    const listBgColor = themeData.listBgColor || 'rgba(103, 58, 183, 0.25)';

    // Draw the glassmorphism box with theme color
    ctx.fillStyle = listBgColor;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    roundRect(ctx, listX, listY, listWidth, listHeight, 20, true, true);

    // Header for members
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Cairo';
    ctx.textAlign = 'left';
    ctx.fillText('👥 Active members', listX + 25, listY + 50);

    // Display Members (3-Column Grid - SORTED by Active then Time)
    const sortedParticipants = Object.entries(timerData.participants)
        .sort(([idA, timeA], [idB, timeB]) => {
            const activeA = timerData.currentParticipants.has(idA) ? 1 : 0;
            const activeB = timerData.currentParticipants.has(idB) ? 1 : 0;
            if (activeA !== activeB) return activeB - activeA;
            return timeB - timeA;
        });

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

async function drawLeaderboard(topUsers, guildMembers, guildId, currentUserId = null, themeData = {}) {
    return await drawLeaderboardCanvas(topUsers, guildMembers, guildId, currentUserId, themeData);
}

/**
 * Canvas-based leaderboard renderer (dynamic responsive height)
 */
async function drawLeaderboardCanvas(topUsers, guildMembers, guildId, currentUserId = null, themeData = {}) {
    const width = 1200;
    const itemHeight = 85; 
    const podiumY = 40;
    const podiumHeight = 450; // Increased to fit title + podium
    const listMarginTop = 30;
    
    // 1. CALCULATE DYNAMIC HEIGHT
    const visibleUsers = topUsers.slice(3);
    const listHeight = visibleUsers.length > 0 ? (visibleUsers.length * itemHeight) + 40 : 0;
    const totalHeight = podiumY + podiumHeight + listHeight + 80;
    
    const canvas = createCanvas(width, totalHeight);
    const ctx = canvas.getContext('2d');

    // 2. BACKGROUND (Radial Gradient from CSS)
    const gradient = ctx.createRadialGradient(width / 2, 0, 100, width / 2, 0, totalHeight);
    gradient.addColorStop(0, '#1a0033'); 
    gradient.addColorStop(1, '#000000'); 
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, totalHeight);

    // Optional background image
    const bgPath = themeData && themeData.path ? path.join(__dirname, '../', themeData.path) : null;
    if (bgPath) {
        try {
            const bg = await loadImage(bgPath);
            const hRatio = canvas.width / bg.width;
            const vRatio = canvas.height / bg.height;
            const ratio = Math.max(hRatio, vRatio);
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.drawImage(bg, 0, 0, bg.width, bg.height, (width - bg.width * ratio) / 2, 0, bg.width * ratio, bg.height * ratio);
            ctx.restore();
        } catch (e) {}
    }

    // 3. PODIUM CONTAINER (Title inside)
    const podiumX = 40;
    const pWidth = width - 80;

    const podiumGrad = ctx.createLinearGradient(podiumX, podiumY, podiumX + pWidth, podiumY + podiumHeight);
    podiumGrad.addColorStop(0, 'rgba(90, 0, 150, 0.4)');
    podiumGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    
    ctx.fillStyle = podiumGrad;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 1;
    roundRectCustom(ctx, podiumX, podiumY, pWidth, podiumHeight, { tl: 0, tr: 0, br: 80, bl: 80 }, true, true);

    // TITLE (Inside Podium)
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 44px Cairo';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FFD700';
    ctx.fillText('🏆 Leaderboard - Study Time', width / 2, podiumY + 30);
    ctx.shadowBlur = 0;

    // 4. DRAW TOP 3
    const podiumConfigs = [
        { rank: 1, relPos: 'center', color: '#FFD700', size: 190, border: 7, glow: 30 },
        { rank: 2, relPos: 'left', color: '#C0C0C0', size: 160, border: 5, glow: 0 },
        { rank: 3, relPos: 'right', color: '#CD7F32', size: 160, border: 5, glow: 0 }
    ];

    const podiumContentY = podiumY + 230; // Center of avatars
    const sideOffset = 260;

    for (const idx of [1, 2, 0]) {
        const config = podiumConfigs[idx];
        const user = topUsers[idx];
        if (!user) continue;

        const itemX = config.relPos === 'center' ? width / 2 : (config.relPos === 'left' ? width / 2 - sideOffset : width / 2 + sideOffset);
        const radius = config.size / 2;
        const member = guildMembers.get(user.userId);
        const avatarUrl = member ? member.user.displayAvatarURL({ extension: 'png', size: 512 }) : null;

        ctx.save();
        if (config.glow > 0) { ctx.shadowBlur = config.glow; ctx.shadowColor = config.color; }
        ctx.strokeStyle = config.color;
        ctx.lineWidth = config.border;
        ctx.beginPath();
        ctx.arc(itemX, podiumContentY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(itemX, podiumContentY, radius - config.border / 2, 0, Math.PI * 2);
        ctx.clip();

        if (avatarUrl) {
            try {
                const avatarImg = await loadImage(avatarUrl);
                ctx.drawImage(avatarImg, itemX - radius, podiumContentY - radius, config.size, config.size);
            } catch (e) { ctx.fillStyle = '#333'; ctx.fill(); }
        } else { ctx.fillStyle = '#333'; ctx.fill(); }
        ctx.restore();

        // Name & Time
        const displayName = member ? member.displayName : user.userId.slice(0, 8);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Cairo';
        ctx.fillText(displayName, itemX, podiumContentY + radius + 35);
        ctx.fillStyle = config.color;
        ctx.font = 'bold 22px Cairo';
        ctx.fillText(`${Math.floor(user.seconds / 60)}m`, itemX, podiumContentY + radius + 65);
    }

    // 5. USERS LIST (Rank 4+)
    if (visibleUsers.length > 0) {
        const listX = 60;
        const listY = podiumY + podiumHeight + listMarginTop;
        const listWidth = width - 120;

        ctx.fillStyle = 'rgba(80, 0, 120, 0.2)';
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
        ctx.lineWidth = 1;
        roundRect(ctx, listX, listY, listWidth, listHeight, 25, true, true);

        for (let i = 0; i < visibleUsers.length; i++) {
            const user = visibleUsers[i];
            const rank = i + 4;
            const itemX = listX + 20;
            const itemY = listY + 20 + (i * itemHeight);
            const iWidth = listWidth - 40;
            const iHeight = itemHeight - 15;
            const isCurrentUser = currentUserId && user.userId === currentUserId;

            // Gradient for item
            const itemGrad = ctx.createLinearGradient(itemX, itemY, itemX + iWidth, itemY + iHeight);
            itemGrad.addColorStop(0, 'rgba(30, 0, 60, 0.6)');
            itemGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');

            ctx.save();
            ctx.fillStyle = itemGrad;
            ctx.strokeStyle = isCurrentUser ? '#00ff4c' : 'rgba(255, 215, 0, 0.1)';
            ctx.lineWidth = isCurrentUser ? 2 : 1;
            if (isCurrentUser) { ctx.shadowBlur = 10; ctx.shadowColor = '#00ff4c'; }
            roundRect(ctx, itemX, itemY, iWidth, iHeight, 15, true, true);
            ctx.restore();

            // PERFECT HORIZONTAL ALIGNMENT (Middle Baseline)
            const centerY = itemY + iHeight / 2;
            ctx.textBaseline = 'middle';

            // Rank
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 24px Cairo';
            ctx.textAlign = 'center';
            ctx.fillText(rank.toString(), itemX + 40, centerY);

            // Avatar
            const member = guildMembers.get(user.userId);
            const avUrl = member ? member.user.displayAvatarURL({ extension: 'png', size: 128 }) : null;
            const avSize = 46;
            const avX = itemX + 85;

            ctx.save();
            ctx.beginPath();
            ctx.arc(avX + avSize/2, centerY, avSize/2, 0, Math.PI * 2);
            ctx.clip();
            if (avUrl) {
                try {
                    const avImg = await loadImage(avUrl);
                    ctx.drawImage(avImg, avX, centerY - avSize/2, avSize, avSize);
                } catch(e) { ctx.fillStyle = '#444'; ctx.fill(); }
            } else { ctx.fillStyle = '#444'; ctx.fill(); }
            ctx.restore();

            // Name
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px Cairo';
            const name = member ? (member.displayName.length > 25 ? member.displayName.slice(0, 23) + '..' : member.displayName) : user.userId.slice(0, 12);
            ctx.fillText(name, avX + avSize + 25, centerY);

            // Time
            ctx.textAlign = 'right';
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 20px Cairo';
            ctx.fillText(`⏱️ ${Math.floor(user.seconds / 60)}m`, itemX + iWidth - 30, centerY);
        }
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

