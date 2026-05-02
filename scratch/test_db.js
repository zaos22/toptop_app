const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pmtbdnkpmiuybsavvytd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtdGJkbmtwbWl1eWJzYXZ2eXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDMzOTksImV4cCI6MjA4NjU3OTM5OX0.S8atF1EwE3E2VYDZR-vH_5DNz1y0aep28DHJTXLhXbI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    try {
        const { data, error } = await supabase.from('establishment_follows').select('count').limit(1);
        if (error) {
            console.log('Error or table does not exist:', error.message);
        } else {
            console.log('Table establishment_follows exists.');
        }

        const { data: ann, error: errAnn } = await supabase.from('announcements').select('count').limit(1);
        if (errAnn) {
            console.log('Error or table announcements does not exist:', errAnn.message);
        } else {
            console.log('Table announcements exists.');
        }
    } catch (e) {
        console.error(e);
    }
}

test();
