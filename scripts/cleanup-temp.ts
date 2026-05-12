import { cleanupExpiredSessions } from "../lib/session-store";

async function main() {
  const result = await cleanupExpiredSessions();
  console.log(`Deleted ${result.deleted} expired session(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
