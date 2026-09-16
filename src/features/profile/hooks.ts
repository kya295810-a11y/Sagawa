import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getProfile,
  ProfileInput,
  updateProfile,
  uploadProfileImage,
} from '@/services/profile/profile-service';
import { useAuthStore } from '@/store/auth-store';

export const profileQueryKey = (userId: string | undefined) => ['profile', userId] as const;

export function useProfile() {
  const userId = useAuthStore((state) => state.session?.user?.id);
  return useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: getProfile,
    enabled: Boolean(userId),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user?.id);
  return useMutation({
    mutationFn: (input: ProfileInput) => updateProfile(input),
    onSuccess: (profile) => queryClient.setQueryData(profileQueryKey(userId), profile),
  });
}

export function useUploadProfileImage() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user?.id);
  return useMutation({
    mutationFn: uploadProfileImage,
    onSuccess: (profile) => queryClient.setQueryData(profileQueryKey(userId), profile),
  });
}
