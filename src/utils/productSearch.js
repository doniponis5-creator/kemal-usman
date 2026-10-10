const CYRILLIC_TO_LATIN = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export const normalizeSearchText = (value) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[ıİ]/g, "i")
  .replace(/№/g, " no ")
  .toLowerCase()
  .replace(/[’'`´]/g, "")
  .replace(/[^a-zа-яё0-9]+/gi, " ")
  .trim()
  .replace(/\s+/g, " ");

const transliterateCyrillic = (value) => value
  .split("")
  .map(char => CYRILLIC_TO_LATIN[char] ?? char)
  .join("");

const textForms = (value) => {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];
  const transliterated = normalizeSearchText(transliterateCyrillic(normalized));
  return transliterated && transliterated !== normalized
    ? [normalized, transliterated]
    : [normalized];
};

const makeField = (value, weight) => textForms(value).map(full => ({
  full,
  words: full.split(" ").filter(Boolean),
  weight,
}));

/** Build once per catalog update; typing only scores these compact strings. */
export const createProductSearchIndex = (products = []) => products.map((product, position) => ({
  product,
  position,
  fields: [
    ...makeField(product.name, 5),
    ...makeField(product.name_kg, 5),
    ...makeField(product.brand, 4),
    ...makeField(product.tags, 2),
    ...makeField(product.category, 1),
    ...makeField(product.shortDesc, 1),
    ...makeField(product.id, 1),
    ...makeField((product.variants || []).map(variant => variant.label).join(" "), 1),
  ],
}));

// Bounded Levenshtein: exits early and avoids a matrix allocation for every word.
const editDistanceWithin = (left, right, maxDistance) => {
  if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    [previous, current] = [current, previous];
  }
  return previous[right.length];
};

const scoreTokenInField = (termForms, field) => {
  let best = 0;
  for (const term of termForms) {
    if (!term) continue;
    for (const word of field.words) {
      if (word === term) best = Math.max(best, 100);
      else if (term.length >= 2 && word.startsWith(term)) best = Math.max(best, 78);
      else if (term.length >= 3 && word.includes(term)) best = Math.max(best, 52);
    }
    if (best < 52 && term.length >= 2 && field.full.includes(term)) best = 46;

    if (best === 0 && term.length >= 4) {
      const tolerance = term.length >= 7 ? 2 : 1;
      for (const word of field.words) {
        if (word.length < 3 || Math.abs(word.length - term.length) > tolerance) continue;
        const distance = editDistanceWithin(term, word, tolerance);
        if (distance <= tolerance) best = Math.max(best, 66 - distance * 12);
      }
    }
  }
  return best > 0 ? best + field.weight * 8 : 0;
};

/**
 * AND-search with relevance ranking, typo tolerance, diacritic folding and
 * Cyrillic → Latin transliteration. The original product objects are returned.
 */
export const searchProductIndex = (index, query, limit = Infinity) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return index.map(entry => entry.product).slice(0, limit);

  const phraseForms = textForms(normalizedQuery);
  const terms = normalizedQuery.split(" ").filter(Boolean).map(textForms);
  const ranked = [];

  for (const entry of index) {
    let score = 0;
    let matched = true;

    for (const termForms of terms) {
      let tokenScore = 0;
      for (const field of entry.fields) {
        tokenScore = Math.max(tokenScore, scoreTokenInField(termForms, field));
      }
      if (tokenScore === 0) {
        matched = false;
        break;
      }
      score += tokenScore;
    }
    if (!matched) continue;

    for (const phrase of phraseForms) {
      for (const field of entry.fields) {
        if (field.full === phrase) score += 500 + field.weight * 20;
        else if (field.full.startsWith(phrase)) score += 260 + field.weight * 12;
        else if (phrase.length >= 3 && field.full.includes(phrase)) score += 140 + field.weight * 8;
      }
    }

    ranked.push({ product: entry.product, score, position: entry.position });
  }

  return ranked
    .sort((a, b) => b.score - a.score || b.position - a.position)
    .slice(0, limit)
    .map(entry => entry.product);
};
