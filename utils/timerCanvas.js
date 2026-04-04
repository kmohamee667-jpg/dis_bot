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

async function drawLeaderboard(topUsers, guildMembers, guildId, currentUserId = null, themeData = {}) {
    return await drawLeaderboardCanvas(topUsers, guildMembers, guildId, currentUserId, themeData);
}

/**
 * Canvas-based leaderboard renderer (fallback or chosen)
 */
async function drawLeaderboardCanvas(topUsers, guildMembers, guildId, currentUserId = null, themeData = {}) {
    const width = 1200;
    const height = 700;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. BACKGROUND (Radial Gradient from CSS)
    const gradient = ctx.createRadialGradient(width / 2, 0, 100, width / 2, 0, width);
    gradient.addColorStop(0, '#1a0033'); // Top color
    gradient.addColorStop(1, '#000000'); // Bottom color
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Optional background image with darker overlay
    const bgPath = themeData && themeData.path ? path.join(__dirname, '../', themeData.path) : null;
    if (bgPath) {
        try {
            const bg = await loadImage(bgPath);
            const hRatio = canvas.width / bg.width;
            const vRatio = canvas.height / bg.height;
            const ratio = Math.max(hRatio, vRatio);
            const centerShiftX = (canvas.width - bg.width * ratio) / 2;
            const centerShiftY = (canvas.height - bg.height * ratio) / 2;
            ctx.save();
            ctx.globalAlpha = 0.4; // Make background image subtle
            ctx.drawImage(bg, 0, 0, bg.width, bg.height, centerShiftX, centerShiftY, bg.width * ratio, bg.height * ratio);
            ctx.restore();
        } catch (e) {}
    }

    // 2. TITLE (from CSS)
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 40px Cairo';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Add text shadow
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FFD700';
    ctx.fillText('🏆 Leaderboard - Study Time', width / 2, 30);
    ctx.shadowBlur = 0; // Reset shadow

    // 3. PODIUM (TOP 3) CONTAINER
    const podiumX = 40;
    const podiumY = 100;
    const podiumWidth = width - 80;
    const podiumHeight = 300;

    // Gradient background for podium
    const podiumGrad = ctx.createLinearGradient(podiumX, podiumY, podiumX + podiumWidth, podiumY + podiumHeight);
    podiumGrad.addColorStop(0, 'rgba(90, 0, 150, 0.4)');
    podiumGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    
    ctx.fillStyle = podiumGrad;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 1;
    // Border radius: 0 0 80px 80px (from CSS)
    roundRectCustom(ctx, podiumX, podiumY, podiumWidth, podiumHeight, { tl: 0, tr: 0, br: 80, bl: 80 }, true, true);

    // 4. DRAW TOP 3 (Podium Items)
    const podiumConfigs = [
        { rank: 1, relPos: 'center', color: '#FFD700', size: 180, border: 6, glow: 25, label: 'Gold' },
        { rank: 2, relPos: 'left', color: '#C0C0C0', size: 150, border: 5, glow: 0, label: 'Silver' },
        { rank: 3, relPos: 'right', color: '#CD7F32', size: 150, border: 5, glow: 0, label: 'Bronze' }
    ];

    const podiumYCenter = podiumY + 140;
    const centerX = width / 2;
    const sideOffset = 240;

    // Draw in order 2, 3, then 1 so 1 is on top if they overlap
    const drawOrder = [1, 2, 0]; 
    for (const idx of drawOrder) {
        const config = podiumConfigs[idx];
        const user = topUsers[idx];
        if (!user) continue;

        let itemX = centerX;
        if (config.relPos === 'left') itemX = centerX - sideOffset;
        if (config.relPos === 'right') itemX = centerX + sideOffset;

        const radius = config.size / 2;
        const member = guildMembers.get(user.userId);
        const avatarUrl = member ? member.user.displayAvatarURL({ extension: 'png', size: 512 }) : null;

        // Draw Avatar with border and glow
        ctx.save();
        if (config.glow > 0) {
            ctx.shadowBlur = config.glow;
            ctx.shadowColor = config.color;
        }
        
        // Border
        ctx.strokeStyle = config.color;
        ctx.lineWidth = config.border;
        ctx.beginPath();
        ctx.arc(itemX, podiumYCenter, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset

        // Clip for avatar
        ctx.beginPath();
        ctx.arc(itemX, podiumYCenter, radius - config.border / 2, 0, Math.PI * 2);
        ctx.clip();

        if (avatarUrl) {
            try {
                const avatarImg = await loadImage(avatarUrl);
                ctx.drawImage(avatarImg, itemX - radius, podiumYCenter - radius, config.size, config.size);
            } catch (e) {
                ctx.fillStyle = '#333';
                ctx.fill();
            }
        } else {
            ctx.fillStyle = '#333';
            ctx.fill();
        }
        ctx.restore();

        // Name and Time below
        const displayName = member ? member.displayName : user.userId.slice(0, 8);
        const mins = Math.floor(user.seconds / 60);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Cairo';
        ctx.fillText(displayName, itemX, podiumYCenter + radius + 40);

        ctx.fillStyle = config.color;
        ctx.font = 'bold 20px Cairo';
        ctx.fillText(`${mins}m`, itemX, podiumYCenter + radius + 65);
    }

    // 5. USERS LIST CONTAINER (Rank 4+)
    const listX = 60;
    const listY = podiumY + podiumHeight + 30;
    const listWidth = width - 120;
    const listPadding = 20;
    
    const visibleUsers = topUsers.slice(3, 8); // Show up to 5 more
    const itemHeight = 75;
    const listHeight = visibleUsers.length > 0 ? (visibleUsers.length * itemHeight) + (listPadding * 2) : 0;

    if (visibleUsers.length > 0) {
        ctx.fillStyle = 'rgba(80, 0, 120, 0.2)';
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
        ctx.lineWidth = 1;
        roundRect(ctx, listX, listY, listWidth, listHeight, 25, true, true);

        for (let i = 0; i < visibleUsers.length; i++) {
            const user = visibleUsers[i];
            const rank = i + 4;
            const itemY = listY + listPadding + (i * itemHeight);
            const itemX = listX + 20;
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
            
            if (isCurrentUser) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00ff4c';
            }
            
            roundRect(ctx, itemX, itemY, iWidth, iHeight, 15, true, true);
            ctx.restore();

            // Rank
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 22px Cairo';
            ctx.textAlign = 'center';
            ctx.fillText(rank.toString(), itemX + 35, itemY + iHeight / 2 + 8);

            // Avatar (small)
            const member = guildMembers.get(user.userId);
            const avUrl = member ? member.user.displayAvatarURL({ extension: 'png', size: 128 }) : null;
            const avSize = 40;
            const avX = itemX + 75;
            const avY = itemY + (iHeight - avSize) / 2;

            ctx.save();
            ctx.beginPath();
            ctx.arc(avX + avSize/2, avY + avSize/2, avSize/2, 0, Math.PI * 2);
            ctx.clip();
            if (avUrl) {
                try {
                    const avImg = await loadImage(avUrl);
                    ctx.drawImage(avImg, avX, avY, avSize, avSize);
                } catch(e) { ctx.fillStyle = '#444'; ctx.fill(); }
            } else { ctx.fillStyle = '#444'; ctx.fill(); }
            ctx.restore();

            // Name
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px Cairo';
            const displayName = member ? (member.displayName.length > 20 ? member.displayName.slice(0, 18) + '..' : member.displayName) : user.userId.slice(0, 12);
            ctx.fillText(displayName, avX + avSize + 20, itemY + iHeight / 2 + 8);

            // Time with Emoji
            ctx.textAlign = 'right';
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 18px Cairo';
            const mins = Math.floor(user.seconds / 60);
            ctx.fillText(`⏱️ ${mins}m`, itemX + iWidth - 25, itemY + iHeight / 2 + 8);
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

