import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Da chiamare in ogni pagina protetta e in ogni Server Action. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
