import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { User } from '../models/User';
import { generateToken, authenticateJwt } from '../passport';

const router = Router();

// Register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, avatarUrl } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ message: 'Username, email, and password are required' });
      return;
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      res.status(400).json({ message: 'Email is already registered' });
      return;
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      res.status(400).json({ message: 'Username is already taken' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const defaultAvatar = avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

    const user = new User({
      username,
      email: email.toLowerCase(),
      passwordHash,
      avatarUrl: defaultAvatar,
      isOnline: true,
      lastSeen: new Date(),
    });

    await user.save();

    const token = generateToken(user);

    const userObj = user.toObject();
    delete (userObj as any).passwordHash;

    res.status(201).json({ token, user: userObj });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message || 'Server error during registration' });
  }
});

// Login
router.post('/login', (req: Request, res: Response, next) => {
  passport.authenticate('local', { session: false }, (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (!user) {
      return res.status(401).json({ message: info?.message || 'Invalid credentials' });
    }

    const token = generateToken(user);
    const userObj = user.toObject();
    delete userObj.passwordHash;

    return res.json({ token, user: userObj });
  })(req, res, next);
});

// Get current user profile
router.get('/me', authenticateJwt, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// Search/list users for contacts list / chat initiation
router.get('/users', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const currentUser = req.user as any;
    const { search } = req.query;

    let query: any = { _id: { $ne: currentUser._id } };

    if (search && typeof search === 'string' && search.trim()) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query).select('-passwordHash').sort({ username: 1 }).limit(50);
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching users' });
  }
});

export default router;
