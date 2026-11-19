// i18n: t(lang, key, vars) with {var} interpolation. Same lookup order as the
// Express app: the language's table, then English, then the key itself.
import { locales as data } from "./locales-data.js";

export type Lang = "ar" | "en" | "fr";
type Table = Record<string, string>;

export const locales = data as unknown as Record<Lang, Table>;
export const LANGS: readonly Lang[] = ["ar", "en", "fr"];
export const DEFAULT_LANG: Lang = "ar";

export type Vars = Record<string, string | number>;
export type Translator = (key: string, vars?: Vars) => string;

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (LANGS as readonly string[]).includes(v);
}

export function t(lang: string, key: string, vars?: Vars): string {
  const table = locales[lang as Lang] || locales[DEFAULT_LANG];
  let s = table[key];
  if (s === undefined) s = locales.en[key];
  if (s === undefined) s = key;
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(String(vars[k]));
  return s;
}
