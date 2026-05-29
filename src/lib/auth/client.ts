import { createAuthClient } from "better-auth/client";

const options: Parameters<typeof createAuthClient>[0] = {};

if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) {
  options.baseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
}

export const authClient = createAuthClient(options);
