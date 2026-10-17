import { en, type MessageKey } from './en';
import { hi } from './hi';

export type Lang = 'en' | 'hi';
export const LANG_COOKIE = 'gm_lang';
export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'hi';

const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, hi };

export type Translator = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): Translator {
  const dict = dictionaries[lang];
  return (key, vars) => {
    const template = dict[key] ?? en[key];
    return vars ? template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : template;
  };
}

/** Error keys from the API -> message key. Anything unknown falls back to the generic server error. */
export function errorMessageKey(apiKey: string | undefined): MessageKey {
  const k = `error.${apiKey ?? 'server_error'}` as MessageKey;
  return Object.hasOwn(en, k) ? k : 'error.server_error';
}

export type { MessageKey };
export { en, hi };
