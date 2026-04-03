# TODO: Timer Enhancements

## Approved Plan Steps:

### 1. ✅ [DONE] Create TODO.md with steps

### 2. ✅ [DONE] Update utils/timerCanvas.js
- Remove special styling for top 3 members (gold/silver/bronze, crowns, shadows).
- Make all member pills uniform (green border/dot for active).
- Add new `drawLeaderboard(topUsers, guildMembers, guildId)` function:
  - Central 3 podium circles: Gold 👑, Silver 🥈, Bronze 🥉 with large avatars.
  - Below: Vertical list #4+ (rank num, avatar, name, time).

### 3. ✅ [DONE] Update commands/start.js
- End of study phase:
  - Mention all voice members before break.
  - Unlock text channel SendMessages for @everyone if denied.
- Final timer end:
  - Generate/send leaderboard image embed + text summary.


### 4. Test
- Run /start timer.
- Verify uniform members list during timer.
- End cycle → mentions + unlock.
- Full end → leaderboard image.

### 5. [PENDING] attempt_completion

