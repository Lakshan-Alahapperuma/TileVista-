const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const designerService = {
  async getLayout(id: string) {
    const response = await fetch(`${API_URL}/designer/layout/${id}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load layout');
    return response.json();
  },

  async createProject(data: any) {
    const response = await fetch(`${API_URL}/designer/project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create project');
    return response.json();
  },

  async updateDimensions(id: string, data: any) {
    const response = await fetch(`${API_URL}/designer/project/${id}/dimensions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update dimensions');
    return response.json();
  },

  async saveLayout(data: any) {
    const response = await fetch(`${API_URL}/designer/layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to save layout');
    return response.json();
  }
};
