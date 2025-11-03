import { Browser, Page } from "puppeteer";

export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    console.log("Launching browser...");
    const isProduction = process.env.NODE_ENV === "production";
    const isVercel = process.env.VERCEL === "1";

    // Use different Puppeteer versions based on environment
    if (isVercel) {
      // Vercel/Serverless environment - use puppeteer-core with @sparticuz/chromium
      const chromium = require("@sparticuz/chromium");
      const puppeteerCore = require("puppeteer-core");

      this.browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // Local/Docker environment - use regular puppeteer
      const puppeteer = require("puppeteer");

      this.browser = await puppeteer.launch({
        headless: isProduction ? true : false,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
    }

    // Ensure browser was initialized successfully
    if (!this.browser) {
      throw new Error("Failed to initialize browser");
    }

    this.page = await this.browser.newPage();

    // Set a realistic viewport and user agent
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error("Browser not initialized. Call initialize() first.");
    }
    return this.page;
  }

  getBrowser(): Browser {
    if (!this.browser) {
      throw new Error("Browser not initialized. Call initialize() first.");
    }
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.browser) {
      console.log("Closing browser...");
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  isInitialized(): boolean {
    return this.browser !== null && this.page !== null;
  }
}
