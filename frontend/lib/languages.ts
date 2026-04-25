export type LanguageOption = {
  code: string;
  label: string;
};

// "multi" = auto-detect via Deepgram Nova-3 multilingual mode.
// All other codes are ISO-639-1.
export const LANGUAGES: LanguageOption[] = [
  { code: "multi", label: "Multilingual (auto-detect)" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "hi", label: "Hindi" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "ko", label: "Korean" },
  { code: "ru", label: "Russian" },
  { code: "nl", label: "Dutch" },
  { code: "tr", label: "Turkish" },
  { code: "pl", label: "Polish" },
  { code: "sv", label: "Swedish" },
  { code: "ar", label: "Arabic" },
  { code: "id", label: "Indonesian" },
  { code: "vi", label: "Vietnamese" },
  { code: "uk", label: "Ukrainian" },
];

export function labelForLanguage(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}
