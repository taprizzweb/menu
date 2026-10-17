import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { LANG_COOKIE, isLang, makeT } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Privacy notice · गोपनीयता सूचना' };

const content = {
  en: [
    ['What we collect from guests', 'Nothing about who you are. We do not ask for your name, phone number, email or location, and there is no account or login. We keep what you order, which table it was for, and when.'],
    ['Cookies and your phone', 'After you place an order or call the waiter, we save one small cookie so your phone can show your table’s live order status. It lasts 12 hours and contains no personal details. Your language choice and your cart are also remembered on your phone only, so they survive a page refresh.'],
    ['Your IP address', 'To stop abuse, such as fake orders, we turn your internet address into a scrambled code that cannot be turned back into the address. The code is deleted within a day. We never store or share the address itself.'],
    ['Google reviews', 'The “Rate us on Google” button opens the restaurant’s Google page, which has its own privacy rules. We only count that the button was pressed; we do not know who pressed it.'],
    ['Staff', 'For restaurant staff accounts we keep an email address and a display name, only so they can log in and so the restaurant can see who did what.'],
    ['Sharing and where data is kept', 'We do not sell data, show ads or use third-party tracking. Data is stored with our hosting provider in India (Mumbai) and is visible only to the restaurant you ordered from.'],
    ['Your choices', 'Because we do not hold personal details about guests, there is usually nothing to look up or delete. If you have a question, please ask the restaurant team.'],
  ],
  hi: [
    ['हम मेहमानों से क्या जमा करते हैं', 'आपकी पहचान के बारे में कुछ नहीं। हम आपका नाम, फ़ोन नंबर, ईमेल या लोकेशन नहीं माँगते, और कोई अकाउंट या लॉगिन नहीं है। हम सिर्फ़ यह रखते हैं कि आपने क्या ऑर्डर किया, किस टेबल के लिए और कब।'],
    ['कुकी और आपका फ़ोन', 'ऑर्डर देने या वेटर को बुलाने के बाद हम एक छोटी कुकी सेव करते हैं ताकि आपका फ़ोन आपकी टेबल के ऑर्डर की लाइव स्थिति दिखा सके। यह 12 घंटे चलती है और इसमें कोई निजी जानकारी नहीं होती। आपकी भाषा और कार्ट सिर्फ़ आपके फ़ोन में याद रखे जाते हैं, ताकि पेज रिफ़्रेश करने पर भी बने रहें।'],
    ['आपका IP पता', 'फ़र्ज़ी ऑर्डर जैसे दुरुपयोग को रोकने के लिए हम आपके इंटरनेट पते को एक ऐसे कोड में बदल देते हैं जिसे वापस पते में नहीं बदला जा सकता। यह कोड एक दिन के भीतर मिटा दिया जाता है। हम असली पता न सेव करते हैं, न किसी से साझा करते हैं।'],
    ['Google रिव्यू', '“Google पर हमें रेट करें” बटन रेस्टोरेंट का Google पेज खोलता है, जिसके अपने गोपनीयता नियम हैं। हम सिर्फ़ गिनते हैं कि बटन दबाया गया; हमें नहीं पता कि किसने दबाया।'],
    ['स्टाफ़', 'रेस्टोरेंट स्टाफ़ के अकाउंट के लिए हम सिर्फ़ ईमेल और दिखने वाला नाम रखते हैं, ताकि वे लॉगिन कर सकें और रेस्टोरेंट देख सके कि क्या किसने किया।'],
    ['साझा करना और डेटा कहाँ रहता है', 'हम डेटा बेचते नहीं, विज्ञापन नहीं दिखाते और किसी तीसरे पक्ष की ट्रैकिंग का उपयोग नहीं करते। डेटा हमारे होस्टिंग प्रदाता के पास भारत (मुंबई) में रहता है और सिर्फ़ उसी रेस्टोरेंट को दिखता है जहाँ से आपने ऑर्डर किया।'],
    ['आपके विकल्प', 'चूँकि हम मेहमानों की निजी जानकारी नहीं रखते, इसलिए आमतौर पर खोजने या मिटाने के लिए कुछ नहीं होता। कोई सवाल हो तो कृपया रेस्टोरेंट की टीम से पूछें।'],
  ],
} as const;

export default async function Privacy() {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(c) ? c : 'en';
  const t = makeT(lang);
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-3xl font-extrabold">{t('privacy.title')}</h1>
      <div className="mt-6 space-y-6">
        {content[lang].map(([h, p]) => (
          <section key={h}>
            <h2 className="text-lg font-bold">{h}</h2>
            <p className="mt-1 text-stone-800">{p}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
