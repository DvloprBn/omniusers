'use server';

import { revalidatePath } from 'next/cache';
import { serverFetch, ApiError } from '@/lib/api';

export interface UserFormState {
  error?: string;
  tempPassword?: string;
}

export async function createUser(_prevState: UserFormState, formData: FormData): Promise<UserFormState> {
  const email = String(formData.get('email') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const roleId = Number(formData.get('role_id'));

  if (!email) return { error: 'El correo es obligatorio.' };
  if (!roleId) return { error: 'Elige un rol.' };

  try {
    const created = await serverFetch<{ welcome_email_sent: boolean; temp_password?: string }>('/users', {
      method: 'POST',
      body: JSON.stringify({ email, name: name || undefined, role_id: roleId }),
    });
    revalidatePath('/admin/usuarios');
    return created.welcome_email_sent ? {} : { tempPassword: created.temp_password };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

export async function updateUserRole(userId: string, roleId: number) {
  await serverFetch(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ role_id: roleId }) });
  revalidatePath('/admin/usuarios');
}

export async function toggleUserActive(userId: string, nextActive: boolean) {
  await serverFetch(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ is_active: nextActive }) });
  revalidatePath('/admin/usuarios');
}
