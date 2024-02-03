export interface JwtPayload {
  userId?: number | string;
  sub: number | string;
  email: string;
}
