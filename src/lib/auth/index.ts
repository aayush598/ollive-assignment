// Auth is now handled by Clerk (@clerk/nextjs).
// Server-side auth helpers are in ./api.ts
// This file is kept as a re-export point.
export { getSession, requireAuth } from "./api";
