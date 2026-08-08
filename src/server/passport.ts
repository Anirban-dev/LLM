import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from './models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp_secret_jwt_key_2026';

export function configurePassport(): void {
  // Local Strategy for Login
  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (email, password, done) => {
        try {
          const user = await User.findOne({ email: email.toLowerCase() });
          if (!user) {
            return done(null, false, { message: 'Invalid credentials' });
          }

          const isMatch = await bcrypt.compare(password, user.passwordHash);
          if (!isMatch) {
            return done(null, false, { message: 'Invalid credentials' });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // JWT Strategy for protected routes
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: JWT_SECRET,
      },
      async (jwtPayload, done) => {
        try {
          const user = await User.findById(jwtPayload.id).select('-passwordHash');
          if (user) {
            return done(null, user);
          }
          return done(null, false);
        } catch (err) {
          return done(err, false);
        }
      }
    )
  );
}

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

export const authenticateJwt = passport.authenticate('jwt', { session: false });
