import { Package, CreatePackagePayload } from '../types/package';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tilevista_admin_token') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export const packageService = {
  async getPackages(includeInactive = false): Promise<Package[]> {
    const endpoint = includeInactive ? `${API_URL}/packages/admin` : `${API_URL}/packages`;
    const response = await fetch(endpoint, {
      headers: includeInactive ? getAuthHeaders() : {},
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Failed to load packages');
    return response.json();
  },

  async getPackage(id: string): Promise<Package> {
    const response = await fetch(`${API_URL}/packages/${id}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Failed to load package ${id}`);
    return response.json();
  },

  async createPackage(data: CreatePackagePayload): Promise<Package> {
    const response = await fetch(`${API_URL}/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.message || 'Failed to create package');
    }
    return response.json();
  },

  async updatePackage(id: string, data: Partial<CreatePackagePayload>): Promise<Package> {
    const response = await fetch(`${API_URL}/packages/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.message || 'Failed to update package');
    }
    return response.json();
  },

  async deletePackage(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/packages/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.message || 'Failed to delete package');
    }
  },

  async uploadCoverImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/packages/upload-cover`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.message || 'Failed to upload cover image');
    }
    const data = await response.json();
    return data.imageUrl;
  },
};
