import { getCountryDataList, languages as langMap } from "countries-list";

export const COUNTRIES = getCountryDataList().map((c) => c.name).sort();

export const LANGUAGES = Object.values(langMap)
  .map((l) => l.name)
  .sort();

export const NICHES = [
  "automotive",
  "beauty",
  "books",
  "business",
  "cooking",
  "education",
  "entertainment",
  "fashion",
  "finance",
  "fitness",
  "food",
  "gaming",
  "health",
  "home",
  "lifestyle",
  "luxury",
  "music",
  "outdoors",
  "parenting",
  "pets",
  "photography",
  "science",
  "sports",
  "tech",
  "travel",
  "wellness",
] as const;
