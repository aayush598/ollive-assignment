import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function getSession() {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const id = userId;
  const name = clerkUser.fullName ?? clerkUser.firstName ?? "User";
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const image = clerkUser.imageUrl;

  await db
    .insert(schema.user)
    .values({ id, name, email, image })
    .onConflictDoUpdate({ target: schema.user.id, set: { name, email, image } });

  return {
    user: { id, name, email, image },
  };
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}
