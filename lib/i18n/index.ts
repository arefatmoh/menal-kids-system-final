import en from "./en"
import am from "./am"

export const translations = { en, am }
export type Language = keyof typeof translations
export type TranslationKey = keyof typeof en


