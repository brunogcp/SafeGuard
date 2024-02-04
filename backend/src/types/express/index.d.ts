import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

declare global {
  namespace Express {
    interface Request {
      user: JwtPayload;
    }
  }
}
