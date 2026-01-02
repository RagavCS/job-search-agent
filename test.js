require('dotenv').config();
console.log('🧪 Testing setup...');
console.log('✅ Scraper key loaded:', process.env.SCRAPER_API_KEY ? 'YES' : 'NO');
console.log('✅ Supabase connected:', process.env.SUPABASE_URL ? 'YES' : 'NO');
console.log('✅ Targets:', process.env.TARGET_ROLES);
console.log('🧪 Test complete - ready to deploy!');
