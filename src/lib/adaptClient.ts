/**
 * Adapt / director endpoint.
 * - Local `npm run dev`: Express `/api/gemini/adapt`
 * - GitHub Pages: set VITE_ADAPT_URL to the Supabase Edge Function URL
 */
export function adaptEndpoint(): string {
  const fromEnv = import.meta.env.VITE_ADAPT_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.replace(/\/$/, '');
  return '/api/gemini/adapt';
}

/** Runtime identity is unique even when Gemini or deterministic fallbacks reuse a source id. */
export function adaptiveRuntimeId(sourceId: string, now: number, sequence: number): string {
  const safeSource = sourceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'rescue';
  return `adaptive_${safeSource}_${Math.max(0, Math.floor(now)).toString(36)}_${Math.max(0, sequence).toString(36)}`;
}
