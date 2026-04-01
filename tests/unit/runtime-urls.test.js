import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("runtime URL resolution", () => {
  const originalBaseUrl = process.env.BASE_URL;
  const originalPublicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  beforeEach(() => {
    delete process.env.BASE_URL;
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = originalBaseUrl;

    if (originalPublicBaseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
    else process.env.NEXT_PUBLIC_BASE_URL = originalPublicBaseUrl;
  });

  it("prefers BASE_URL for internal server calls when request origin is backend ip", async () => {
    process.env.BASE_URL = "http://127.0.0.1:20128/";
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.example.com/";

    const { getInternalBaseUrl } = await import("../../src/lib/runtimeUrls.js");

    const request = {
      url: "http://203.0.113.10:20128/api/models/test",
    };

    expect(getInternalBaseUrl(request)).toBe("http://127.0.0.1:20128");
  });

  it("falls back to NEXT_PUBLIC_BASE_URL when BASE_URL is missing", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.example.com/";

    const { getInternalBaseUrl } = await import("../../src/lib/runtimeUrls.js");

    const request = {
      url: "http://203.0.113.10:20128/api/models/test",
    };

    expect(getInternalBaseUrl(request)).toBe("https://app.example.com");
  });

  it("falls back to request origin only when no configured base url exists", async () => {
    const { getInternalBaseUrl } = await import("../../src/lib/runtimeUrls.js");

    const request = {
      url: "http://203.0.113.10:20128/api/models/test",
    };

    expect(getInternalBaseUrl(request)).toBe("http://203.0.113.10:20128");
  });
});
