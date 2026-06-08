const AUTH_ERROR_MAP: Record<string, string> = {
  "Invalid login credentials": "Email or password is incorrect. Check your credentials and try again.",
  "Email not confirmed": "Your email hasn't been confirmed yet. Check your inbox or contact your admin.",
  "Too many requests": "Too many sign-in attempts. Please wait a moment and try again.",
};

export function mapAuthError(message: string): string {
  if (AUTH_ERROR_MAP[message]) return AUTH_ERROR_MAP[message];
  if (message.toLowerCase().includes("invalid login")) {
    return "Email or password is incorrect. Check your credentials and try again.";
  }
  if (message.toLowerCase().includes("network")) {
    return "Network error. Check your connection and try again.";
  }
  return message;
}

export function validateLoginForm(email: string, password: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Enter a valid email address.";
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}
