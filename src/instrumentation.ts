export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startIngestionListener } = await import(
        "./lib/ingestion/postgres-listener"
      );
      await startIngestionListener();
    } catch {
      // listener fallback is handled internally
    }
  }
}
