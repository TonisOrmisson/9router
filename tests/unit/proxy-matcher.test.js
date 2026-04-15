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
  it("runs for login and static asset requests when strict IP blocking is enabled", async () => {
    const { config } = await import("../../src/proxy.js");

    expect(matchesConfig("/login", config.matcher)).toBe(true);
    expect(matchesConfig("/_next/static/chunks/main.js", config.matcher)).toBe(true);
    expect(matchesConfig("/favicon.ico", config.matcher)).toBe(true);
    expect(matchesConfig("/images/logo.svg", config.matcher)).toBe(true);
  });
});
