import { proxy as dashboardProxy } from "./dashboardGuard";

export default async function proxy(request) {
  return dashboardProxy(request);
}

export const config = {
  matcher: ["/:path*"],
};
