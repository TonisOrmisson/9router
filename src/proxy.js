export { proxy } from "./dashboardGuard";

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/api/:path*",
    "/v1/:path*",
    "/v1beta/:path*",
  ],
};
