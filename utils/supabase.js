const { createClient } = require('@supabase/supabase-js');

let supabase = null;

async function getSupabase() {
  if (!supabase) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return supabase;
}

async function safeQuery(supabaseFn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await supabaseFn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      // الانتظار قبل المحاولة مرة أخرى لأي خطأ في الاتصال
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

module.exports = { getSupabase, safeQuery };

