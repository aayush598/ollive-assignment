import { auth } from "./index";
import { headers } from "next/headers";

export async function getSession() {
  const h = await headers();
  return auth.api.getSession({ headers: h });
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}
