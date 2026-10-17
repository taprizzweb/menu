// Runs once when the server boots. A bad or missing setting stops the server immediately with a clear
// message instead of failing later in front of a customer.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { serverEnv } = await import('./env');
    serverEnv();
  }
}
