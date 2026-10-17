export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-extrabold">We could not find this restaurant</h1>
      <p className="mt-2 text-lg font-bold">यह रेस्टोरेंट नहीं मिला</p>
      <p className="mt-3 text-stone-700">Check the address or scan the QR code again. / पता जाँचें या QR कोड दोबारा स्कैन करें।</p>
    </main>
  );
}
