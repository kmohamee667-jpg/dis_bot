# rm-all Confirmation Feature

## Status: Ready to implement

**Plan (approved):**
- Add ephemeral confirmation embed before deletions
- 30s message collector: admin (khal3d0047) + 'YES'
- Collect → delete channels
- Timeout → cancel + cleanup

**Steps:**
- [x] Edit events/commands/rm-all.js ✅ **FULL WIPE** (Buttons + roles + members ban/kick except protected + final mention)
- [x] Update TODO ✅
- [ ] ⚠️ Test carefully (dangerous!)

**Files:** events/commands/rm-all.js
