import { apiFetch, setTokens, clearTokens } from './client';

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  date_joined: string;
  last_login: string | null;
}

export async function register(
  username: string,
  email: string,
  password: string,
  password2: string,
): Promise<void> {
  await apiFetch('/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, password2 }),
  });
}

export async function login(username: string, password: string): Promise<void> {
  const tokens = await apiFetch<AuthTokens>('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setTokens(tokens.access, tokens.refresh);
}

export async function logout(): Promise<void> {
  const refresh = localStorage.getItem('refresh_token');
  if (refresh) {
    await apiFetch('/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({ refresh }),
    }).catch(() => {});
  }
  clearTokens();
}

export function getMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/auth/me/');
}
