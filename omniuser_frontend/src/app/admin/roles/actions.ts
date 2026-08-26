'use server';

import { revalidatePath } from 'next/cache';
import { serverFetch, ApiError } from '@/lib/api';

export interface RoleFormState {
  error?: string;
}

export async function createRole(_prevState: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!name) return { error: 'El nombre es obligatorio.' };

  try {
    await serverFetch('/roles', { method: 'POST', body: JSON.stringify({ name, description: description || undefined }) });
    revalidatePath('/admin/roles');
    return {};
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

export async function deleteRole(roleId: number) {
  await serverFetch(`/roles/${roleId}`, { method: 'DELETE' });
  revalidatePath('/admin/roles');
}
