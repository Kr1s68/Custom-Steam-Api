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
        args: [
          ...chromium.args,
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
        ],
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
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
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

    // Set Steam cookies to bypass age gate and appear more like a real user
    await this.page.setCookie(
      {
        name: "birthtime",
        value: "568022401", // Jan 1, 1988 (over 18)
        domain: ".steamcommunity.com",
        path: "/",
        expires: Date.now() / 1000 + 31536000, // 1 year
      },
      {
        name: "mature_content",
        value: "1",
        domain: ".steamcommunity.com",
        path: "/",
        expires: Date.now() / 1000 + 31536000,
      },
      {
        name: "lastagecheckage",
        value: "1-0-1988",
        domain: ".steamcommunity.com",
        path: "/",
        expires: Date.now() / 1000 + 31536000,
      },
      {
        name: "wants_mature_content",
        value: "1",
        domain: ".steamcommunity.com",
        path: "/",
        expires: Date.now() / 1000 + 31536000,
      }
    );

    // Stealth mode: Remove webdriver property and automation indicators
    await this.page.evaluateOnNewDocument(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });

      // Override the navigator.plugins to appear more real
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override chrome property to appear more real
      (window as any).chrome = {
        runtime: {},
      };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === "notifications"
          ? Promise.resolve({
              state: Notification.permission,
            } as PermissionStatus)
          : originalQuery(parameters);
    });
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
