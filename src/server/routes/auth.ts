import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Otp } from '../models/Otp';
import { generateToken, authenticateJwt } from '../auth';

const router = Router();

// 1. Register with Email + Password
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, avatarUrl } = req.body;

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

    const defaultAvatar =
      avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

    const user = new User({
      username: username.trim(),
      email: normalizedEmail,
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

// 2. Login with Email + Password
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ message: 'This account was created via Google/OTP login. Please sign in using Google or OTP.' });
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
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Server error during login' });
  }
});

// 3. Send OTP
router.post('/send-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      res.status(400).json({ message: 'Valid email address is required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Generate random 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Delete any existing OTP for this email
    await Otp.deleteMany({ email: normalizedEmail });

    // Save new OTP
    const newOtp = new Otp({
      email: normalizedEmail,
      otp: code,
      expiresAt,
    });
    await newOtp.save();

    console.log(`🔑 OTP Code generated for ${normalizedEmail}: ${code}`);

    res.json({
      message: `OTP sent successfully to ${normalizedEmail}`,
      otp: code, // Returned for convenient testing in preview environment
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: error.message || 'Failed to send OTP' });
  }
});

// 4. Verify OTP & Sign In
router.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, username } = req.body;

    if (!email || !otp) {
      res.status(400).json({ message: 'Email and OTP code are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const otpRecord = await Otp.findOne({ email: normalizedEmail, otp: otp.trim() });
    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired OTP code' });
      return;
    }

    // Check expiration
    if (new Date() > otpRecord.expiresAt) {
      await Otp.deleteOne({ _id: otpRecord._id });
      res.status(400).json({ message: 'OTP code has expired. Please request a new one.' });
      return;
    }

    // Delete OTP once verified
    await Otp.deleteOne({ _id: otpRecord._id });

    // Find or create user
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const derivedUsername =
        username?.trim() ||
        normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') ||
        'User' + Math.floor(Math.random() * 10000);

      const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(derivedUsername)}`;

      user = new User({
        username: derivedUsername,
        email: normalizedEmail,
        avatarUrl,
        isOnline: true,
        lastSeen: new Date(),
      });
      await user.save();
    }

    const token = generateToken(user);
    const userObj = user.toObject();
    delete (userObj as any).passwordHash;

    res.json({ token, user: userObj, message: 'OTP verification successful' });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: error.message || 'OTP verification failed' });
  }
});

// 5. Login with Google
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, avatarUrl, googleId } = req.body;

    if (!email) {
      res.status(400).json({ message: 'Google account email is required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const derivedUsername =
        name?.trim() ||
        normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') ||
        'GoogleUser';

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
    console.error('Google Sign-In error:', error);
    res.status(500).json({ message: error.message || 'Google authentication failed' });
  }
});

// 6. Get current user profile
router.get('/me', authenticateJwt, (req: Request, res: Response) => {
  res.json({ user: (req as any).user });
});

// 7. Search/list users
router.get('/users', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
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
