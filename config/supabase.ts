import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Reemplaza estos valores con los de tu proyecto de Supabase
// Los puedes encontrar en Settings -> API
const supabaseUrl = 'https://pmtbdnkpmiuybsavvytd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtdGJkbmtwbWl1eWJzYXZ2eXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDMzOTksImV4cCI6MjA4NjU3OTM5OX0.S8atF1EwE3E2VYDZR-vH_5DNz1y0aep28DHJTXLhXbI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
