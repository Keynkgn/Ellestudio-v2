// ── Supabase ──────────────────────────────────────────────────
const SUPA_URL = 'https://bwgiktpsmrvfaoyoftwy.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3Z2lrdHBzbXJ2ZmFveW9mdHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzY2NjUsImV4cCI6MjA4NzU1MjY2NX0.-3YsxigCNWDeZnW8uLSro6UXsHhRNLmcJHEap0fnHz0';
const supa = supabase.createClient(SUPA_URL, SUPA_KEY);

// ── Auth ──────────────────────────────────────────────────────
const PASSWORDS = { admin: 'Lyelle01', worker: 'Lyelle02' };
const SESSION_KEY = 'es2_role';
const SESSION_TS_KEY = 'es2_ts';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 días

// ── App state ─────────────────────────────────────────────────
let currentRole = null;   // 'admin' | 'worker'
let patients    = [];
let registros   = [];
let preCitas    = [];
let citas       = [];
