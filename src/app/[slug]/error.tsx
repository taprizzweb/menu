'use client';
import { useEffect } from 'react';

// Shown when something unexpected fails while loading a menu. No technical details are displayed.
export default function MenuError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The server already logged the real error; the digest lets us find it.
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-extrabold">Something went wrong · कुछ गड़बड़ हो गई</h1>
      <p className="mt-3 text-stone-700">Please try again. / कृपया दोबारा कोशिश करें।</p>
      {error.digest && <p className="mt-2 text-xs text-stone-600">Ref: {error.digest}</p>}
      <button type="button" onClick={reset} className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-stone-900 px-6 font-semibold text-white">
        Try again · फिर कोशिश करें
      </button>
    </main>
  );
}
