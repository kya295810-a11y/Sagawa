import { Platform } from 'react-native';
import { apiRequest } from '@/services/api/client';
import { ApiResponse, Profile } from '@/types/profile';

export type ProfileInput = {
  name: string;
  age: number;
  gender: 'male' | 'female';
  location?: string;
};

export async function getProfile() {
  const response = await apiRequest<ApiResponse<Profile>>('/api/profile');
  return response.data;
}

export async function updateProfile(input: ProfileInput) {
  const response = await apiRequest<ApiResponse<Profile>>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify({ ...input, platform: Platform.OS }),
  });
  return response.data;
}

export async function uploadProfileImage(formData: FormData) {
  const response = await apiRequest<ApiResponse<Profile>>('/api/profile/image', {
    method: 'POST',
    body: formData,
  });
  return response.data;
}
