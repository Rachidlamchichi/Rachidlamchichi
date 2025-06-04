import { Router, Request, Response } from 'express';
import Joi from 'joi';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallbackSecret'; // Fallback for safety

// --- Schemas for Validation ---
const userRegistrationSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

const userLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(), // Min length check can be skipped here or kept, depends on desired UX
});


// --- Route Handlers ---

// POST /users/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    // 1. Validate input
    const { error, value } = userRegistrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ statusCode: 400, message: error.details[0].message });
    }
    const { email, password } = value;

    // 2. Check if user exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ statusCode: 409, message: 'User already exists' });
    }

    // 3. Hash password
    const saltRounds = 10; // Standard practice
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Store user
    const newUserResult = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );
    const newUser = newUserResult.rows[0];

    // 5. Return response
    return res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        createdAt: newUser.created_at,
      },
    });

  } catch (err) {
    console.error('Error during registration:', err);
    // Type guard for Error objects
    if (err instanceof Error) {
        return res.status(500).json({ statusCode: 500, message: 'Internal server error: ' + err.message });
    }
    return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
});

// POST /users/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    // 1. Validate input
    const { error, value } = userLoginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ statusCode: 400, message: error.details[0].message });
    }
    const { email, password } = value;

    // 2. Find user
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ statusCode: 404, message: 'User not found' });
    }
    const user = userResult.rows[0];

    // 3. Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ statusCode: 401, message: 'Invalid credentials' });
    }

    // 4. Generate JWT
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' } // Token expiration time
    );

    // 5. Return response
    return res.status(200).json({ accessToken });

  } catch (err) {
    console.error('Error during login:', err);
    if (err instanceof Error) {
        return res.status(500).json({ statusCode: 500, message: 'Internal server error: ' + err.message });
    }
    return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
});

export default router;
