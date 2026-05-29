import { auth, currentUser } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
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

  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(sql`${schema.user.email} = ${email}`)
    .limit(1);

  if (existing.length > 0) {
    const userId = existing[0].id;
    await db.update(schema.user).set({ name, email, image }).where(eq(schema.user.id, userId));
    return {
      user: { id: userId, name, email, image },
    };
  }

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
