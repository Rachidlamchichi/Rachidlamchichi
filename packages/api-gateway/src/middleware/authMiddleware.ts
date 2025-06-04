import { Request, Response, NextFunction } from 'express';

export const checkAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const [scheme, token] = authHeader.split(' ');
    if (scheme === 'Bearer' && token) {
      console.log(`[Auth] Token found: ${token.substring(0, 10)}...`); // Log first 10 chars for brevity
      // In a real app, you would verify the token here (e.g., using jsonwebtoken)
      // For MVP, we'll assume if a Bearer token is present, it's valid.
      // You might attach user info to req: (req as any).user = decodedToken;
      return next();
    }
  }

  // For now, let's allow requests without valid auth for most routes.
  // Specific routes might enforce this more strictly.
  console.log('[Auth] No valid Bearer token found in Authorization header.');
  // For MVP, we are not sending 401 here to allow easier testing of underlying services.
  // To protect a route, you would send a 401 response:
  // return res.status(401).json({ message: 'Unauthorized: Access token is missing or invalid.' });
  next();
};

// Example of a stricter check that could be used on specific routes
export const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const [scheme, token] = authHeader.split(' ');
        if (scheme === 'Bearer' && token) {
            // Add real token validation here
            console.log(`[EnsureAuth] Token validated (placeholder): ${token.substring(0,10)}...`);
            // (req as any).user = { id: 'mockUserId', roles: ['user'] }; // Example user payload
            return next();
        }
    }
    return res.status(401).json({ message: 'Unauthorized: Access token is required and valid.' });
};
