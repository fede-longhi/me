import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export { auth as proxy };

export const proxyConfig = {
  matcher: ["/admin", "/admin/:path*"],
};
