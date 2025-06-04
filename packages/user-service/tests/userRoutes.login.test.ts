import request from 'supertest';
import { app } from '../src/index';
import { mockQuery } from '../src/test-setup';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock bcrypt.compare and jwt.sign
jest.mock('bcrypt', () => ({
  ...jest.requireActual('bcrypt'),
  compare: jest.fn(),
  hash: jest.fn(), // Keep hash mocked if other tests for registration are in same context or if needed
}));
jest.mock('jsonwebtoken', () => ({
  ...jest.requireActual('jsonwebtoken'),
  sign: jest.fn(),
}));

describe('POST /users/login', () => {
  const userData = { email: 'test@example.com', password: 'password123' };
  const dbUser = {
    id: 'uuid-test-id',
    email: userData.email,
    password_hash: 'hashedPassword123',
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    mockQuery.mockReset();
    (bcrypt.compare as jest.Mock).mockReset();
    (jwt.sign as jest.Mock).mockReset();
  });

  it('should login an existing user successfully', async () => {
    // Mock DB query to find user
    mockQuery.mockResolvedValueOnce({ rows: [dbUser], rowCount: 1 });
    // Mock bcrypt.compare to return true (passwords match)
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    // Mock jwt.sign to return a token
    const fakeToken = 'fake-jwt-token';
    (jwt.sign as jest.Mock).mockReturnValue(fakeToken);

    const response = await request(app)
      .post('/users/login')
      .send(userData);

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBe(fakeToken);
    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: dbUser.id, email: dbUser.email },
      process.env.JWT_SECRET || 'fallbackSecret', // Ensure this matches your JWT_SECRET logic
      { expiresIn: '1h' }
    );
  });

  it('should return 404 if user not found', async () => {
    // Mock DB query to find user (no user found)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await request(app)
      .post('/users/login')
      .send(userData);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('User not found');
  });

  it('should return 401 if password does not match', async () => {
    // Mock DB query to find user
    mockQuery.mockResolvedValueOnce({ rows: [dbUser], rowCount: 1 });
    // Mock bcrypt.compare to return false (passwords don't match)
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const response = await request(app)
      .post('/users/login')
      .send(userData);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid credentials');
  });

  it('should return 400 for invalid email format during login', async () => {
    const invalidLoginData = { email: 'invalid-email', password: 'password123' };
    const response = await request(app)
      .post('/users/login')
      .send(invalidLoginData);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('"email" must be a valid email');
  });

  it('should return 400 for missing password during login', async () => {
    const invalidLoginData = { email: 'test@example.com' }; // Missing password
    const response = await request(app)
      .post('/users/login')
      .send(invalidLoginData);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('"password" is required');
  });

  it('should return 500 if database query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const response = await request(app)
      .post('/users/login')
      .send(userData);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('Internal server error');
  });

  it('should return 500 if bcrypt.compare fails', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [dbUser], rowCount: 1 });
    (bcrypt.compare as jest.Mock).mockRejectedValueOnce(new Error('bcrypt error'));

    const response = await request(app)
      .post('/users/login')
      .send(userData);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('Internal server error');
  });

  it('should return 500 if jwt.sign fails', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [dbUser], rowCount: 1 });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockImplementation(() => {
      throw new Error('JWT signing error');
    });

    const response = await request(app)
      .post('/users/login')
      .send(userData);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('Internal server error');
  });
});
