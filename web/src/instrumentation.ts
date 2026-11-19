// Runs once when the Next.js server starts: the Express app's 60-second timer —
// recurring deposits, the 24h expiry of unpaid deposit requests, and scheduled
// withdrawal actions.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startJobTimer } = await import("./server/job-timer");
  startJobTimer();
}
