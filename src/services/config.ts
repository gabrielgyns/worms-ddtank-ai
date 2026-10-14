/** Configuração do servidor (Supabase). Vazia = modo local. Ver docs/servidor.md. */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const hasServer = (): boolean => SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;
