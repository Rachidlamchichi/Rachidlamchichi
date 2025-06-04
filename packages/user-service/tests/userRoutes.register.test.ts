import request from 'supertest';
import { app } from '../src/index'; // Import the exported app
import { mockQuery } from '../src/test-setup'; // Import the mockQuery to control DB responses
import bcrypt from 'bcrypt';

// Mock bcrypt.hash globally for all tests in this file
jest.mock('bcrypt', () => ({
  ...jest.requireActual('bcrypt'), // Import and retain default behavior
  hash: jest.fn(), // Mock the hash function
  compare: jest.fn(), // Also mock compare if it's used in the same file/module by other routes
}));

describe('POST /users/register', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockQuery.mockReset();
    (bcrypt.hash as jest.Mock).mockReset();
  });

  it('should register a new user successfully', async () => {
    const userData = { email: 'test@example.com', password: 'password123' };
    const hashedPassword = 'hashedPassword123';
    const dbUser = { id: 'uuid-test-id', email: userData.email, created_at: new Date().toISOString() };

    // Mock DB query for checking if user exists (no user found)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // Mock bcrypt.hash
    (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
    // Mock DB query for inserting user
    mockQuery.mockResolvedValueOnce({ rows: [dbUser], rowCount: 1 });

    const response = await request(app)
      .post('/users/register')
      .send(userData);

    expect(response.status).toBe(201);
    expect(response.body.user).toBeDefined();
    expect(response.body.user.id).toBe(dbUser.id);
    expect(response.body.user.email).toBe(userData.email);
    expect(response.body.user.createdAt).toBeDefined();
    expect(response.body.user.password).toBeUndefined(); // Ensure password is not returned

    // Check if DB insert was called correctly
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [userData.email, hashedPassword]
    );
  });

  it('should return 409 if email already exists', async () => {
    const userData = { email: 'existing@example.com', password: 'password123' };
    // Mock DB query for checking if user exists (user found)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'some-id', email: userData.email }], rowCount: 1 });

    const response = await request(app)
      .post('/users/register')
      .send(userData);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('User already exists');
  });

  it('should return 400 for invalid email format', async () => {
    const userData = { email: 'invalid-email', password: 'password123' };
    const response = await request(app)
      .post('/users/register')
      .send(userData);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('"email" must be a valid email');
  });

  it('should return 400 for password too short', async () => {
    const userData = { email: 'test@example.com', password: '123' }; // Password less than 8 chars
    const response = await request(app)
      .post('/users/register')
      .send(userData);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('"password" length must be at least 8 characters long');
  });

  it('should return 500 if database query fails during user check', async () => {
    const userData = { email: 'test@example.com', password: 'password123' };
    mockQuery.mockRejectedValueOnce(new Error('DB error during check'));

    const response = await request(app)
      .post('/users/register')
      .send(userData);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('Internal server error');
  });

  it('should return 500 if bcrypt hashing fails', async () => {
    const userData = { email: 'test@example.com', password: 'password123' };
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // User does not exist
    (bcrypt.hash as jest.Mock).mockRejectedValueOnce(new Error('Hashing failed'));

    const response = await request(app)
      .post('/users/register')
      .send(userData);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('Internal server error');
  });

  it('should return 500 if database query fails during user insertion', async () => {
    const userData = { email: 'test@example.com', password: 'password123' };
    const hashedPassword = 'hashedPassword123';

    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // User does not exist
    (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword); // Hashing succeeds
    mockQuery.mockRejectedValueOnce(new Error('DB error during insert')); // Insertion fails

    const response = await request(app)
      .post('/users/register')
      .send(userData);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('Internal server error');
  });
});
