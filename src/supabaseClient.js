// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grkdongkdmrotbyhnmtt.supabase.co'; // Вставьте сюда ваш Project URL
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdya2RvbmdrZG1yb3RieWhubXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNTU0NjYsImV4cCI6MjA2NzYzMTQ2Nn0.KXF0jLXzscjBOUk1vHpz3MT3S9A2gmyZ9r5jmXkg6x0'; // Вставьте сюда ваш anon (public) ключ

export const supabase = createClient(supabaseUrl, supabaseAnonKey);