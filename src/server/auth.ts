import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User, IUser } from './models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp_secret_jwt_key_2026';

export function generateToken(user: IUser): string {
  return jwt.sign(
    { id: user._id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

export async function authenticateJwt(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authorization token required' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token) as { id: string };

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      res.status(401).json({ message: 'User not found or token invalid' });
      return;
    }

    (req as any).user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
