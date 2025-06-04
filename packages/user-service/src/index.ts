import express from 'express';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes'; // Import the user routes
import pool from './db'; // Import pool to initialize connection early

dotenv.config();

export const app = express(); // Export app
const port = process.env.USER_SERVICE_PORT || 3001;

// Middleware
app.use(express.json()); // To parse JSON request bodies

// Routes
app.use('/users', userRoutes); // Mount the user routes under /users prefix

// Basic health check route
app.get('/', (req, res) => {
  res.send('User service is running!');
});

// Test DB connection route (optional, for debugging)
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0].now });
  } catch (err) {
    if (err instanceof Error) {
        res.status(500).json({ error: 'Failed to connect to database: ' + err.message });
    } else {
        res.status(500).json({ error: 'Failed to connect to database' });
    }
  }
});

// Start the server only if this file is run directly (not imported as a module)
if (require.main === module) {
  app.listen(port, () => {
    console.log(`User service listening at http://localhost:${port}`);
    // Attempt to connect to DB to ensure it's available
    pool.connect().then(client => {
      console.log('Database pool connected successfully on startup.');
      client.release();
    }).catch(err => {
      console.error('Failed to connect database pool on startup:', err);
    });
  });
}
