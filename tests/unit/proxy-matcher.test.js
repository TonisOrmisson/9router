import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/dashboardGuard.js", () => ({
  proxy: vi.fn(),
}));

function matchesSingleMatcher(pathname, matcher) {
  if (matcher === "/") return pathname === "/";

  if (matcher.endsWith("/:path*")) {
    const basePath = matcher.slice(0, -"/:path*".length);
    return pathname === basePath || pathname.startsWith(`${basePath}/`);
  }

  return new RegExp(`^${matcher}$`).test(pathname);
}

function matchesConfig(pathname, matchers) {
  return matchers.some((matcher) => matchesSingleMatcher(pathname, matcher));
}

describe("proxy matcher", () => {
  it("still runs for dotted v1beta model routes", async () => {
    const { config } = await import("../../src/proxy.js");

    expect(
      matchesConfig(
        "/v1beta/models/gemini-1.5-pro:generateContent",
        config.matcher
      )
    ).toBe(true);
  });

  it("does not run for static assets", async () => {
    const { config } = await import("../../src/proxy.js");

    expect(matchesConfig("/favicon.ico", config.matcher)).toBe(false);
    expect(matchesConfig("/logo.svg", config.matcher)).toBe(false);
  });
});
