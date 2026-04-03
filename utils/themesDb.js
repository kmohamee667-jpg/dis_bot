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

function getThemeChoicesSync() {
    if (!themeChoicesCache) {
        // Fallback static themes if DB empty
        themeChoicesCache = [
            { name: '🌃 Neon Night', value: 'neon' },
            { name: '🌿 Nature Forest', value: 'nature' },
            { name: '☁️ Minimalist', value: 'minimal' },
            { name: '⚔️ Toji', value: 'Toje' },
            { name: '🌌 Galaxy', value: 'Galaxy' }
        ];
    }
    return themeChoicesCache;
}

async function getThemeChoices() {
    await loadThemes();
    themeChoicesCache = Object.entries(themesCache).map(([key, data]) => ({
        name: `${data.emoji || '🖼️'} ${data.name}`,
        value: key
    }));
    return themeChoicesCache;
}

module.exports = { loadThemes, getTheme, getThemeChoices, getThemeChoicesSync };

