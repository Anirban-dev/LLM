import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { setMemoryOtp, verifyMemoryOtp } from '../services/otpCache';
import { generateToken, authenticateJwt } from '../auth';

const router = Router();

// 1. Password Login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.passwordHash) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const token = generateToken(user);
    const userObj = user.toObject();
    delete (userObj as any).passwordHash;

    res.json({ token, user: userObj });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error during login' });
  }
});

// 2. Request Sign Up OTP (Stores in 5-min Memory Cache)
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ message: 'Username, email, and password are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      res.status(400).json({ message: 'Email is already registered' });
      return;
    }

    const existingUsername = await User.findOne({ username: username.trim() });
    if (existingUsername) {
      res.status(400).json({ message: 'Username is already taken' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate 6-digit OTP code and hold in 5-minute memory cache
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    setMemoryOtp(normalizedEmail, code, {
      username: username.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    console.log(`🔑 [5-Min Memory OTP] Generated for ${normalizedEmail}: ${code}`);

    res.json({
      requireOtp: true,
      message: `OTP verification code sent! (Valid for 5 minutes)`,
      otp: code, // Returned for instant preview testing
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Registration failed' });
  }
});

// 3. Verify Sign Up OTP (5-min Memory Cache) & Complete Registration
router.post('/verify-signup-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ message: 'Email and 6-digit OTP code are required' });
      return;
    }

    const result = verifyMemoryOtp(email, otp);
    if (!result.valid || !result.pendingData) {
      res.status(400).json({ message: result.message || 'Invalid or expired OTP' });
      return;
    }

    const { username, email: regEmail, passwordHash } = result.pendingData;

    const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

    const user = new User({
      username,
      email: regEmail,
      passwordHash,
      avatarUrl: defaultAvatar,
      isOnline: true,
      lastSeen: new Date(),
    });

    await user.save();

    const token = generateToken(user);
    const userObj = user.toObject();
    delete (userObj as any).passwordHash;

    res.status(201).json({ token, user: userObj, message: 'Account verified and created successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'OTP verification error' });
  }
});

// 4. Google Sign-In / OAuth
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, avatarUrl } = req.body;

    if (!email) {
      res.status(400).json({ message: 'Google account email is required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const derivedUsername =
        name?.trim() || normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'GoogleUser';

      const userAvatar =
        avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(derivedUsername)}`;

      user = new User({
        username: derivedUsername,
        email: normalizedEmail,
        avatarUrl: userAvatar,
        isOnline: true,
        lastSeen: new Date(),
      });
      await user.save();
    }

    const token = generateToken(user);
    const userObj = user.toObject();
    delete (userObj as any).passwordHash;

    res.json({ token, user: userObj, message: 'Google Sign-In successful' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Google authentication failed' });
  }
});

// 5. Current Profile & Search Users
router.get('/me', authenticateJwt, (req: Request, res: Response) => {
  res.json({ user: (req as any).user });
});

router.get('/users', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { search } = req.query;

    const query: any = { _id: { $ne: currentUser._id } };
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
