const { getSupabase, safeQuery } = require('./supabase');
let themesCache = null;

/**
 * Load all themes from DB (cached)
 */
async function loadThemes() {
    if (themesCache) return themesCache;
    
    const supabase = await getSupabase();
    const data = await safeQuery(async () => {
        const { data, error } = await supabase
            .from('themes')
            .select('*')
            .order('name');
        if (error) throw error;
        return data;
    });

    if (!data || data.length === 0) {
        console.warn('⚠️ themes table empty - using fallback');
        themesCache = {};
        return themesCache;
    }

    themesCache = {};
    data.forEach(row => {
        themesCache[row.theme_key] = {
            name: row.name,
            emoji: row.emoji || '',
            path: row.path,
            color: row.color,
            circleColor: row.circle_color
        };
    });

    console.log(`✅ Loaded ${Object.keys(themesCache).length} themes from DB`);
    return themesCache;
}

/**
 * Get single theme by key
 */
async function getTheme(themeKey) {
    const themes = await loadThemes();
    return themes[themeKey] || null;
}

/**
 * Get all theme choices for slash command
 */
let themeChoicesCache = null;

/**
 * Synchronously get cached theme choices (returns empty array if not loaded yet)
 */
function getThemeChoicesSync() {
    return themeChoicesCache || [];
}

/**
 * Load themes from database and update cache (call once at startup)
 */
async function getThemeChoices() {
    await loadThemes();
    themeChoicesCache = Object.entries(themesCache).map(([key, data]) => ({
        name: `${data.emoji || '🖼️'} ${data.name}`,
        value: key
    }));
    console.log(`✅ Cached ${themeChoicesCache.length} theme choices for slash commands`);
    return themeChoicesCache;
}

/**
 * Refresh theme choices from database (useful for detecting new/deleted themes)
 */
async function refreshThemeChoices() {
    themesCache = null; // Clear cache to force reload
    return await getThemeChoices();
}

module.exports = { loadThemes, getTheme, getThemeChoices, getThemeChoicesSync, refreshThemeChoices };

