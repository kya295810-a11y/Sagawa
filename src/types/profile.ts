export type Profile = {
  name: string;
  phoneNumber: string;
  address: string;
  profileImage: string;
  updatedAt?: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
};