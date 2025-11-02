import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import express, { Express, Request, Response } from "express";
import itemRoutes from "./routes/itemRoutes";

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req: Request, _res: Response, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api", itemRoutes);

// Root endpoint
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Steam Market Scraper API",
    version: "1.0.0",
    authentication: {
      required: true,
      method: "API Key",
      headerName: "x-api-key",
      queryParam: "apiKey",
    },
    endpoints: {
      health: "GET /api/health (public)",
      scrapeItem:
        "GET /api/item?appId=<appId>&itemName=<itemName>&currency=<USD|EUR>&apiKey=<key> (protected)",
    },
    examples: {
      withHeader:
        "curl -H 'x-api-key: YOUR_API_KEY' http://localhost:3000/api/item?appId=730&itemName=AK-47%20|%20Redline%20(Field-Tested)&currency=USD",
      withQuery:
        "/api/item?appId=730&itemName=AK-47 | Redline (Field-Tested)&currency=USD&apiKey=YOUR_API_KEY",
    },
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "Endpoint not found",
    availableEndpoints: ["/", "/api/health", "/api/item"],
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║  Steam Market Scraper API                             ║
║  Server running on http://localhost:${PORT}           ║
║                                                       ║
║  Available endpoints:                                 ║
║  • GET /                   - API info                 ║
║  • GET /api/health         - Health check             ║
║  • GET /api/item           - Scrape item              ║
║                                                       ║
║  Example:                                             ║
║  /api/item?appId=730&itemName=AK-47 | Redline (Field-Tested)&currency=USD
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

export default app;
