import 'express';

declare module 'express' {
  interface Request {
    userId?: string;
    user?: {
      sub: string;
      email?: string;
      name?: string;
    };
  }
}
