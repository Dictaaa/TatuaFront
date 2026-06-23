// ============================================================
// TATUA · Auth Interfaces
// ============================================================

export interface LoginDto {
  slug:     string;
  password: string;
}

export interface RegisterDto {
  name:     string;
  slug:     string;
  handle:   string;
  city_id:  number;
  whatsapp: string;
  email:    string;
  password: string;
}

export interface AuthArtist {
  id:     number;
  name:   string;
  slug:   string;
  handle: string;
}

export interface AuthResponse {
  token:  string;
  artist: AuthArtist;
}

export type UserRole = 'artist' | 'admin';