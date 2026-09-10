import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { readFileSync } from "fs";
import path from "path";
import { z } from "zod";
import { authConfig } from "@/auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function parseHashValue(raw: string | undefined): string | undefined {
  const value = raw?.trim().replace(/^['"]|['"]$/g, "");
  if (!value) return undefined;
  if (value.startsWith("$2")) return value;
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    if (decoded.startsWith("$2")) return decoded;
  } catch {
    // ignore
  }
  return undefined;
}

function readHashFromEnvLocal(): string | undefined {
  try {
    const text = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const line = text
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("ADMIN_PASSWORD_HASH="));
    return parseHashValue(line?.slice("ADMIN_PASSWORD_HASH=".length));
  } catch {
    return undefined;
  }
}

function getAdminPasswordHash(): string | undefined {
  return (
    parseHashValue(process.env.ADMIN_PASSWORD_HASH) ?? readHashFromEnvLocal()
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const adminEmail = process.env.ADMIN_EMAIL?.trim();
        const passwordHash = getAdminPasswordHash();
        if (!adminEmail || !passwordHash) {
          if (process.env.ADMIN_PASSWORD_HASH && !passwordHash) {
            console.error(
              "[auth] ADMIN_PASSWORD_HASH is not a usable bcrypt hash after env loading.",
            );
          }
          return null;
        }

        if (parsed.data.email.trim().toLowerCase() !== adminEmail.toLowerCase()) {
          return null;
        }

        const valid = await compare(parsed.data.password, passwordHash);
        if (!valid) return null;

        return {
          id: "admin",
          email: adminEmail,
          name: "Admin",
        };
      },
    }),
  ],
});
