import express from 'express';
import bcrypt from 'bcrypt';
import prisma from '../db.js';
import { signToken } from '../utils/jwt.js';

console.log("AUTH ROUTES LOADED");

const router = express.Router();

router.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password required',
    });
  }

  if (!email.includes('@')) {
    return res.status(400).json({
      error: 'Not a valid email',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: 'Password must be at least 6 characters',
    });
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return res.status(409).json({
      error: 'User already exists',
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });

  res.status(201).json({
    id: user.id,
    email: user.email,
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password required',
    });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({
      error: 'Invalid credentials',
    });
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    return res.status(401).json({
      error: 'Invalid credentials',
    });
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
  });

  res.json({ token });
});

export default router;