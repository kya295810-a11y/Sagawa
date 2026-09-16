export type Profile = {
  name: string;
  age: number | null;
  gender: 'male' | 'female' | null;
  location: string;
  profileImage: string;
  profileCompleted: boolean;
  updatedAt?: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};
