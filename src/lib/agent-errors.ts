export function friendlyAgentError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");

  if (/rate limit|429|busy|tokens per minute/i.test(msg)) {
    return "Groq rate limit hit — wait ~10 seconds, then try a shorter question.";
  }
  if (/unauthorized|not signed/i.test(msg)) {
    return "Please sign in again.";
  }
  if (/admin access/i.test(msg)) {
    return "This assistant is for admins only.";
  }
  if (/not configured|GROQ_API_KEY/i.test(msg)) {
    return "AI is not set up yet.";
  }
  if (/network|failed to fetch|connection/i.test(msg)) {
    return "Connection issue. Check your internet.";
  }
  if (/empty ai response/i.test(msg)) {
    return "No response from AI. Try again.";
  }

  return "Something went wrong. Please try again.";
}
