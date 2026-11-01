import { passkey } from "@better-auth/passkey";
import * as schema from "@telaio/db";
import { eq, getDb } from "@telaio/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";

const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/** Lunghezza minima delle password scelta nella configurazione iniziale (8 se non impostata). */
export async function passwordMinima(): Promise<number> {
  try {
    const [riga] = await getDb()
      .select()
      .from(schema.impostazioni)
      .where(eq(schema.impostazioni.chiave, "sicurezza"));
    const minimo = (riga?.valore as { passwordMinima?: number } | undefined)?.passwordMinima;
    return typeof minimo === "number" && minimo >= 8 ? minimo : 8;
  } catch {
    return 8;
  }
}

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
  hooks: {
    // La politica scelta nel setup vale anche per i cambi di password, non solo nell'interfaccia.
    before: createAuthMiddleware(async (ctx) => {
      if (!["/change-password", "/reset-password", "/set-password"].includes(ctx.path)) return;
      const nuova = (ctx.body as { newPassword?: unknown } | undefined)?.newPassword;
      if (typeof nuova !== "string") return;
      const minimo = await passwordMinima();
      if (nuova.length < minimo)
        throw new APIError("BAD_REQUEST", {
          message: `La password deve avere almeno ${minimo} caratteri`,
          code: "PASSWORD_TOO_SHORT",
        });
    }),
  },
  plugins: [
    twoFactor({ issuer: "Telaio" }),
    passkey({ rpID: new URL(baseUrl).hostname, rpName: "Telaio", origin: baseUrl }),
    nextCookies(), // sempre ultimo
  ],
});
