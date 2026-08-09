export interface SocketUser {
  id: string;
  email: string;
  username: string;
}

export type UserSocketsMap = Map<string, Set<string>>;
