export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export const STATIC_BASE = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : 'http://localhost:4000';
export const ITEMS_PER_PAGE = 9;

