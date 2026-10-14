import { hasServer } from './config';
import { LocalBackend } from './localBackend';
import { SupabaseBackend } from './supabaseBackend';
import type { Backend } from './types';

let backend: Backend | null = null;

/** O backend do jogo: Supabase se configurado, senão local. */
export function getBackend(): Backend {
  backend ??= hasServer() ? new SupabaseBackend() : new LocalBackend();
  return backend;
}
