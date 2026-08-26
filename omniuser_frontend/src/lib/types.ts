export interface AuthenticatedUser {
  userId: string;
  role: string;
  name: string | null;
  email: string;
  must_change_password: boolean;
  totp_enabled: boolean;
}

export interface Role {
  role_id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

export interface AdminUser {
  user_id: string;
  email: string;
  name: string | null;
  is_active: boolean;
  must_change_password: boolean;
  totp_enabled: boolean;
  created_at: string;
  roles: { role_id: number; name: string };
}
