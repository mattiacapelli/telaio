import { passkey } from "@better-auth/passkey";
import * as schema from "@telaio/db";
import { getDb } from "@telaio/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";

const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  baseURL: baseUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      twoFactor: schema.twoFactors,
      passkey: schema.passkeys,
    },
  }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    additionalFields: { role: { type: "string", defaultValue: "admin", input: false } },
  },
  plugins: [
    twoFactor({ issuer: "Telaio" }),
    passkey({ rpID: new URL(baseUrl).hostname, rpName: "Telaio", origin: baseUrl }),
    nextCookies(), // sempre ultimo
  ],
});
