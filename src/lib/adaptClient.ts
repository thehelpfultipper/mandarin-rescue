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
