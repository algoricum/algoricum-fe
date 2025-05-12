export interface User {
  id?: string;
  email: string;
  name?: string;
  address?: string;
}

export interface UserState {
  user: User | null;
  isLoading: boolean;
}
