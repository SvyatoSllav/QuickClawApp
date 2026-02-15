import { ProfileData, profileFromJson } from './profile';

export interface UserData {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  profile: ProfileData | null;
}

export interface AuthResponse {
  token: string;
  user: UserData;
  created: boolean;
}

export function userFromJson(json: Record<string, unknown>): UserData {
  return {
    id: json['id'] as number,
    email: json['email'] as string,
    firstName: json['first_name'] as string,
    lastName: json['last_name'] as string,
    profile: json['profile']
      ? profileFromJson(json['profile'] as Record<string, unknown>)
      : null,
  };
}

export function authResponseFromJson(json: Record<string, unknown>): AuthResponse {
  return {
    token: json['token'] as string,
    user: userFromJson(json['user'] as Record<string, unknown>),
    created: json['created'] as boolean,
  };
}
