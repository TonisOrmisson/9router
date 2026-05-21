import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => ({ type: "next", status: 200 })),
    json: vi.fn((body, init) => ({
      type: "json",
      status: init?.status || 200,
      body,
    })),
    redirect: vi.fn((url) => ({
      type: "redirect",
      status: 307,
      location: String(url),
    })),
  },
}));

vi.mock("jose", () => ({
  jwtVerify: vi.fn(async () => ({ payload: {} })),
}));

vi.mock("@/lib/localDb", () => ({
  getSettings: vi.fn(async () => ({ requireLogin: true })),
  validateApiKey: vi.fn(async () => false),
}));

vi.mock("@/shared/utils/machineId", () => ({
  getConsistentMachineId: vi.fn(async () => "cli-token"),
}));

vi.mock("@/lib/auth/dashboardSession", () => ({
  verifyDashboardAuthToken: vi.fn(async (token) => token === "valid-session"),
}));

describe("dashboardGuard IP allowlist", () => {
  const originalEnabled = process.env.IP_ALLOWLIST_ENABLED;
  const originalAllowlist = process.env.IP_ALLOWLIST;

  beforeEach(() => {
    process.env.IP_ALLOWLIST_ENABLED = "true";
    process.env.IP_ALLOWLIST = "203.0.113.10";
  });

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.IP_ALLOWLIST_ENABLED;
    else process.env.IP_ALLOWLIST_ENABLED = originalEnabled;

    if (originalAllowlist === undefined) delete process.env.IP_ALLOWLIST;
    else process.env.IP_ALLOWLIST = originalAllowlist;
  });

  it("blocks non-allowlisted requests before they reach app routes", async () => {
    const { proxy } = await import("../../src/dashboardGuard.js");

    const response = await proxy({
      headers: new Headers({
        host: "app.example.com",
        "x-forwarded-for": "198.51.100.20",
      }),
      nextUrl: {
        pathname: "/v1/responses",
        origin: "https://app.example.com",
      },
      cookies: { get: () => undefined },
      url: "https://app.example.com/v1/responses",
    });

    expect(response).toEqual({
      type: "json",
      status: 403,
      body: { error: "Forbidden" },
    });
  });

  it("lets allowlisted public LLM requests reach the API key gate", async () => {
    const { proxy } = await import("../../src/dashboardGuard.js");

    const response = await proxy({
      headers: new Headers({
        host: "app.example.com",
        "x-forwarded-for": "203.0.113.10",
      }),
      nextUrl: {
        pathname: "/v1/responses",
        origin: "https://app.example.com",
      },
      cookies: { get: () => undefined },
      url: "https://app.example.com/v1/responses",
    });

    expect(response).toEqual({
      type: "json",
      status: 401,
      body: { error: "API key required for remote API access" },
    });
  });

  it("allows protected api requests when requireLogin is disabled in settings", async () => {
    const { getSettings } = await import("@/lib/localDb");
    vi.mocked(getSettings).mockResolvedValueOnce({ requireLogin: false });

    const { proxy } = await import("../../src/dashboardGuard.js");

    const response = await proxy({
      headers: new Headers({
        host: "app.example.com",
        "x-forwarded-for": "203.0.113.10",
      }),
      nextUrl: {
        pathname: "/api/settings",
        origin: "https://app.example.com",
      },
      cookies: { get: () => undefined },
      url: "https://app.example.com/api/settings",
    });

    expect(response).toEqual({
      type: "next",
      status: 200,
    });
  });

  it("allows authenticated dashboard api writes even when client ip is not allowlisted", async () => {
    const { proxy } = await import("../../src/dashboardGuard.js");

    const response = await proxy({
      headers: new Headers({
        host: "app.example.com",
        "x-forwarded-for": "198.51.100.20",
      }),
      nextUrl: {
        pathname: "/api/providers/f9c75809-97a6-4baf-831c-3cffce15c6aa",
        origin: "https://app.example.com",
      },
      cookies: { get: () => ({ value: "valid-session" }) },
      url: "https://app.example.com/api/providers/f9c75809-97a6-4baf-831c-3cffce15c6aa",
    });

    expect(response).toEqual({
      type: "next",
      status: 200,
    });
  });

  it("sends unauthenticated dashboard api writes to the auth gate instead of IP allowlist", async () => {
    const { proxy } = await import("../../src/dashboardGuard.js");

    const response = await proxy({
      headers: new Headers({
        host: "app.example.com",
        "x-forwarded-for": "198.51.100.20",
      }),
      nextUrl: {
        pathname: "/api/providers/732b9653-1044-42f1-baf0-e7206d64e56a",
        origin: "https://app.example.com",
      },
      cookies: { get: () => undefined },
      url: "https://app.example.com/api/providers/732b9653-1044-42f1-baf0-e7206d64e56a",
    });

    expect(response).toEqual({
      type: "json",
      status: 401,
      body: { error: "Unauthorized" },
    });
  });

  it("allows dashboard api writes with requireLogin disabled even when client ip is not allowlisted", async () => {
    const { getSettings } = await import("@/lib/localDb");
    vi.mocked(getSettings).mockResolvedValueOnce({ requireLogin: false });
    const { proxy } = await import("../../src/dashboardGuard.js");

    const response = await proxy({
      headers: new Headers({
        host: "app.example.com",
        "x-forwarded-for": "198.51.100.20",
      }),
      nextUrl: {
        pathname: "/api/providers/732b9653-1044-42f1-baf0-e7206d64e56a",
        origin: "https://app.example.com",
      },
      cookies: { get: () => undefined },
      url: "https://app.example.com/api/providers/732b9653-1044-42f1-baf0-e7206d64e56a",
    });

    expect(response).toEqual({
      type: "next",
      status: 200,
    });
  });
});
