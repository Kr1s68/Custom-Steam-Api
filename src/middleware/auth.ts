import { Request, Response, NextFunction } from "express";

export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: "Access Denied",
      message: "API key is required. Provide it via 'x-api-key' header or 'apiKey' query parameter.",
    });
    return;
  }

  const validApiKeys = process.env.VALID_API_KEYS?.split(",") || [];

  if (!validApiKeys.includes(apiKey as string)) {
    res.status(403).json({
      success: false,
      error: "Access Denied",
      message: "Invalid API key.",
    });
    return;
  }

  // API key is valid, proceed to the route handler
  next();
}
