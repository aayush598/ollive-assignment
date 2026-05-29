import { createAuthClient } from "better-auth/client";

const options: Parameters<typeof createAuthClient>[0] = {};

if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) {
  options.baseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
} else if (process.env.NEXT_PUBLIC_APP_URL) {
  options.baseURL = process.env.NEXT_PUBLIC_APP_URL;
}
// When neither is set, better-auth defaults to window.location.origin
// which is the correct behavior for Vercel deployments

export const authClient = createAuthClient(options);
