const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export interface CreateModelProjectInput {
  name: string;
  description?: string;
  video: File;
  itemId?: number | string;
}

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tilevista_admin_token') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function createModelProject(input: CreateModelProjectInput) {
  const formData = new FormData();
  formData.append('name', input.name);
  if (input.description) {
    formData.append('description', input.description);
  }
  if (input.itemId) {
    formData.append('itemId', String(input.itemId));
  }
  formData.append('video', input.video);

  const response = await fetch(`${API_URL}/model-generator/projects/video`, {
    method: 'POST',
    body: formData,
    headers: {
      ...getAuthHeaders(),
      // Note: Do not set Content-Type header manually for FormData so boundary is appended correctly
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? 'Unable to create the 3D model project');
  }

  return response.json();
}

export async function findUserProjects() {
  const response = await fetch(`${API_URL}/model-generator/projects`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to retrieve user projects');
  }

  return response.json();
}

export async function findProject(projectId: string) {
  const response = await fetch(`${API_URL}/model-generator/projects/${projectId}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to retrieve project details');
  }

  return response.json();
}

export async function getModelProjectStatus(projectId: string) {
  const response = await fetch(`${API_URL}/model-generator/projects/${projectId}/status`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to retrieve the model status');
  }

  return response.json();
}

export async function removeProject(projectId: string) {
  const response = await fetch(`${API_URL}/model-generator/projects/${projectId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Unable to delete the project');
  }

  return response.json();
}
