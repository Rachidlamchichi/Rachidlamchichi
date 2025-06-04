import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import proxy from 'express-http-proxy';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { checkAuth } from './middleware/authMiddleware';

dotenv.config();

export const app = express();
const port = process.env.PORT || 3000;

// --- Global Middleware ---
// Logging
app.use(morgan('dev'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(limiter);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- Service URLs ---
const userServiceUrl = process.env.USER_SERVICE_URL;
const listingServiceUrl = process.env.LISTING_SERVICE_URL;

if (!userServiceUrl) {
    console.warn("Warning: USER_SERVICE_URL is not set in .env. User service proxy will be disabled.");
}
if (!listingServiceUrl) {
    console.warn("Warning: LISTING_SERVICE_URL is not set in .env. Listing service proxy will be disabled.");
}

// --- Proxy Routes ---
// Base path for V1 API
const V1_API_BASE = '/api/v1';

// User Service
if (userServiceUrl) {
  app.use(`${V1_API_BASE}/users`, checkAuth, proxy(userServiceUrl, { // Apply checkAuth
    proxyReqPathResolver: (req: Request) => {
      const newPath = `${V1_API_BASE}/users${req.url}`;
      console.log(`GW: Proxying to User Service: ${userServiceUrl}${req.url} (original was ${req.originalUrl} -> ${newPath})`);
      // The target service for /users is expected to handle /users/* routes directly.
      // So if gateway path is /api/v1/users/login, target path should be /users/login
      return req.url.startsWith('/') ? `/users${req.url}` : `/users/${req.url}`;
    },
    proxyErrorHandler: (err: any, res: Response, next: NextFunction) => {
      console.error(`[GW] Proxy error to User Service: ${err.message}`);
      if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({ message: 'User service is unavailable.' });
      }
      next(err);
    }
  }));
  console.log(`Proxying ${V1_API_BASE}/users to ${userServiceUrl}/users`);
}

// Listing Service (handles /listings and /categories)
if (listingServiceUrl) {
  const listingProxyOptions = {
    proxyErrorHandler: (err: any, res: Response, next: NextFunction) => {
      console.error(`[GW] Proxy error to Listing Service: ${err.message}`);
      if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({ message: 'Listing service is unavailable.' });
      }
      next(err);
    }
  };

  // Apply checkAuth to routes that likely need protection, e.g. POST to listings.
  // GET routes are often public.
  // For this example, applying checkAuth to all listing and category routes for simplicity.
  app.use(`${V1_API_BASE}/listings`, checkAuth, proxy(listingServiceUrl, { // Apply checkAuth
    ...listingProxyOptions,
    proxyReqPathResolver: (req: Request) => {
      console.log(`GW: Proxying to Listing Service (listings): ${listingServiceUrl}${req.url}`);
      return req.url.startsWith('/') ? `/listings${req.url}` : `/listings/${req.url}`;
    },
  }));

  app.use(`${V1_API_BASE}/categories`, checkAuth, proxy(listingServiceUrl, { // Apply checkAuth
    ...listingProxyOptions,
    proxyReqPathResolver: (req: Request) => {
      console.log(`GW: Proxying to Listing Service (categories): ${listingServiceUrl}${req.url}`);
      return req.url.startsWith('/') ? `/categories${req.url}` : `/categories/${req.url}`;
    },
  }));
  console.log(`Proxying ${V1_API_BASE}/listings and ${V1_API_BASE}/categories to ${listingServiceUrl}`);
}


// --- Basic Gateway Routes ---
app.get('/', (req: Request, res: Response) => {
  res.send('API Gateway is running!');
});
app.get(`${V1_API_BASE}`, (req: Request, res: Response) => {
    res.send('API Gateway v1 is active.');
});


// --- Global Error Handler ---
// This should be after all other middleware and routes
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("[GW] Global Error Handler:", err.stack || err);
  // Avoid sending stack traces to the client in production
  const statusCode = err.status || err.statusCode || 500; // err.statusCode for proxy errors
  const message = err.message || 'An unexpected error occurred on the gateway.';

  res.status(statusCode).json({ message });
});


// --- Server Startup ---
if (require.main === module) {
  app.listen(port, () => {
    console.log(`API Gateway listening at http://localhost:${port}`);
  });
}
