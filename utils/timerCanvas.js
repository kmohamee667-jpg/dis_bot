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
    const itemHeight = 35; // smaller to fit more members
    const itemWidth = (listWidth - 40) / colCount;
    const maxItems = 30; // show up to 30 members

    ctx.font = 'bold 13px Cairo';
    for (let i = 0; i < Math.min(sortedParticipants.length, maxItems); i++) {
        const [userId, totalSeconds] = sortedParticipants[i];
        const participantName = timerData.participantNames[userId] || `User ${userId.slice(0, 5)}`;
        const isActive = timerData.currentParticipants.has(userId);
        const avatarUrl = timerData.participantAvatars && timerData.participantAvatars[userId] 
            ? timerData.participantAvatars[userId] 
            : null;

        const row = Math.floor(i / colCount);
        const col = i % colCount;
        
        const itemX = listX + 20 + col * itemWidth;
        const itemY = listY + 80 + row * itemHeight;

        // --- RANKING & STATUS STYLES ---
        let borderColor = 'rgba(255, 255, 255, 0.05)'; // Default: None
        let pillBg = 'rgba(0, 0, 0, 0.4)';
        let rankIcon = '';
        
        // Priority 1: Top 3 Rankings
        if (i === 0 && totalSeconds > 0) {
            borderColor = '#FFD700'; // GOLD
            pillBg = 'rgba(255, 215, 0, 0.2)'; // Gold tint highlight
            rankIcon = '🥇';
        } else if (i === 1 && totalSeconds > 0) {
            borderColor = '#C0C0C0'; // SILVER
            pillBg = 'rgba(192, 192, 192, 0.1)';
            rankIcon = '🥈';
        } else if (i === 2 && totalSeconds > 0) {
            borderColor = '#CD7F32'; // BRONZE
            pillBg = 'rgba(205, 127, 50, 0.1)';
            rankIcon = '🥉';
        }
        
        // Priority 2: Active members (overrides default, but NOT top 3)
        if (isActive && i > 2) {
            borderColor = '#2ecc71'; // Bright Green
        }

        // Draw the Member "Pill"
        ctx.fillStyle = pillBg;
        ctx.strokeStyle = (isActive || i < 3) ? borderColor : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = i < 3 ? 2.5 : 2;
        
        // Outer Glow for TOP 1
        if (i === 0 && totalSeconds > 0) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#FFD700';
        }
        roundRect(ctx, itemX + 5, itemY, itemWidth - 10, 40, 20, true, true);
        ctx.shadowBlur = 0;

        // Circular Avatar placeholder
        ctx.save();
        ctx.beginPath();
        const avatarX = itemX + 24;
        const avatarY = itemY + 20;
        ctx.arc(avatarX, avatarY, 14, 0, Math.PI * 2);
        ctx.clip();
        
        let avatarLoaded = false;
        if (avatarUrl) {
            try {
                const avatarImg = await loadImage(avatarUrl);
                ctx.drawImage(avatarImg, avatarX - 14, avatarY - 14, 28, 28);
                avatarLoaded = true;
            } catch (e) {}
        }
        
        if (!avatarLoaded) {
            ctx.fillStyle = circleColor;
            ctx.fill();
        }
        ctx.restore();

        // Rank Badge / Crown for #1
        if (i === 0 && totalSeconds > 0) {
            ctx.font = '24px Cairo';
            ctx.textAlign = 'center';
            ctx.fillText('👑', itemX - 12, itemY + 28); // Next to the pill
        }

        // Name
        const isTopOne = (i === 0 && totalSeconds > 0);
        ctx.fillStyle = isTopOne ? '#000000' : '#ffffff';
        ctx.textAlign = 'left';
        ctx.font = 'bold 12px Cairo';
        const truncatedName = participantName.length > 7 ? participantName.slice(0, 6) + '.' : participantName;
        ctx.fillText(`${rankIcon} ${truncatedName}`, itemX + 48, itemY + 16);

        // Individual Timer
        const pMins = Math.floor(totalSeconds / 60);
        const pSecs = totalSeconds % 60;
        const pTimeStr = `${pMins}m ${pSecs}s`;
        ctx.fillStyle = isTopOne ? '#000000' : 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'italic 10px Cairo';
        ctx.fillText(pTimeStr, itemX + 48, itemY + 27);

        // Status indicator dot for non-top-3 (if active)
        if (isActive && i > 2) {
            ctx.beginPath();
            ctx.arc(avatarX + 10, avatarY + 10, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#2ecc71';
            ctx.fill();
            ctx.stroke();
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

module.exports = { drawTimer };
