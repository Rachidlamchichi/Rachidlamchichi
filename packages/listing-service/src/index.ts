import express from 'express';
import dotenv from 'dotenv';
import pool from './db'; // Import pool to initialize connection early
import categoryRoutes from './routes/categoryRoutes';
import listingRoutes from './routes/listingRoutes';

dotenv.config();

export const app = express();
const port = process.env.LISTING_SERVICE_PORT || 3002;

// Middleware
app.use(express.json());

// Routes
app.use('/categories', categoryRoutes);
app.use('/listings', listingRoutes);

// Basic health check
app.get('/', (req, res) => {
  res.send('Listing service is running!');
});

// Test DB connection route (optional)
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0].now });
  } catch (err) {
    if (err instanceof Error) {
        res.status(500).json({ error: 'Failed to connect to listing_service database: ' + err.message });
    } else {
        res.status(500).json({ error: 'Failed to connect to listing_service database' });
    }
  }
});

// Start the server only if this file is run directly
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Listing service listening at http://localhost:${port}`);
    pool.connect().then(client => {
      console.log('Listing_service database pool connected successfully on startup.');
      client.release();
    }).catch(err => {
      console.error('Failed to connect listing_service database pool on startup:', err);
    });
  });
}
