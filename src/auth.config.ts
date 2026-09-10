import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/admin/login",
  },
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      if (request.headers.get("Next-Action")) {
        return true;
      }

      const pathname = request.nextUrl.pathname;
      const isLogin = pathname.startsWith("/admin/login");
      const isAdmin = pathname.startsWith("/admin");
      const isLoggedIn = Boolean(auth?.user);

      if (isLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/admin", request.nextUrl));
        }
        return true;
      }

      if (isAdmin) {
        return isLoggedIn;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
