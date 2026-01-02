require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');

// Your credentials
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const TARGET_ROLES = (process.env.TARGET_ROLES || 'localization project manager').split(',');
const TARGET_LOCATIONS = (process.env.TARGET_LOCATIONS || 'remote').split(',');
const MIN_FIT_SCORE = parseInt(process.env.MIN_FIT_SCORE) || 75;

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🚀 Job Search Agent Starting...');

async function scrapeJobs() {
  console.log('📡 Scraping jobs...');
  
  const searchQueries = [
    ...TARGET_ROLES.map(role => `"${role}" jobs ${TARGET_LOCATIONS.join(' OR ')}`),
    ...TARGET_ROLES.map(role => `${role} remote`),
  ];
  
  let allJobs = [];
  
  for (const query of searchQueries) {
    console.log(`🔍 Searching: ${query}`);
    
    // Use Scraper API for LinkedIn/Google Jobs
    try {
      const response = await axios.get('http://api.scraperapi.com', {
        params: {
          api_key: SCRAPER_API_KEY,
          url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=India`,
          render: true,
          country_code: 'in'
        }
      });
      
      const $ = cheerio.load(response.data);
      const jobs = [];
      
      // Parse LinkedIn jobs (simplified)
      $('div.base-card').each((i, elem) => {
        const title = $(elem).find('.base-search-card__title').text().trim();
        const company = $(elem).find('.base-search-card__subtitle').text().trim();
        const link = $(elem).find('a').attr('href');
        
        if (title && company && link) {
          jobs.push({
            title,
            company,
            link: 'https://linkedin.com' + link,
            description: $(elem).text().substring(0, 500),
            location: TARGET_LOCATIONS[0],
            source: 'linkedin',
            created_at: new Date().toISOString()
          });
        }
      });
      
      allJobs = allJobs.concat(jobs.slice(0, 10)); // Top 10 per search
      await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit
      
    } catch (error) {
      console.log(`❌ Error scraping ${query}:`, error.message);
    }
  }
  
  console.log(`📊 Found ${allJobs.length} jobs`);
  
  // Score jobs (simple keyword matching)
  const scoredJobs = allJobs.map(job => ({
    ...job,
    fit_score: calculateFitScore(job)
  })).filter(job => job.fit_score >= MIN_FIT_SCORE);
  
  console.log(`✅ ${scoredJobs.length} high-fit jobs (score >= ${MIN_FIT_SCORE})`);
  
  // Save to Supabase
  if (scoredJobs.length > 0) {
    const { data, error } = await supabase
      .from('jobs')
      .insert(scoredJobs);
    
    if (error) {
      console.error('❌ Supabase error:', error);
    } else {
      console.log(`💾 Saved ${data.length} jobs to database`);
    }
  }
  
  console.log('🎉 Job scraping complete!');
}

function calculateFitScore(job) {
  const score = 50; // Base score
  const keywords = ['localization', 'project manager', 'transcreation', 'remote', 'pm', 'manager'];
  
  let keywordScore = 0;
  keywords.forEach(keyword => {
    if (job.title.toLowerCase().includes(keyword) || 
        job.description.toLowerCase().includes(keyword)) {
      keywordScore += 10;
    }
  });
  
  const locationScore = TARGET_LOCATIONS.some(loc => 
    job.location.toLowerCase().includes(loc.toLowerCase())
  ) ? 20 : 0;
  
  return Math.min(100, score + keywordScore + locationScore);
}

// Test mode
if (process.argv.includes('--test')) {
  scrapeJobs().catch(console.error);
} else {
  // Run once
  scrapeJobs().catch(console.error);
}

// Optional: Schedule daily (if running as service)
if (process.env.NODE_ENV === 'production') {
  cron.schedule('0 9 * * *', () => {
    console.log('⏰ Daily job search starting...');
    scrapeJobs();
  }, {
    timezone: 'Asia/Kolkata'
  });
  
  console.log('⏰ Scheduled for 9 AM IST daily');
}
