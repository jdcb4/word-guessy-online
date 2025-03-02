import words from '../data/words.json';

interface Word {
  word: string;
  category: string;
  difficulty: string;
}

export function getWords(settings: {
  categories: string[];
  difficulties: string[];
}): Word[] {
  return words.filter(
    (word) =>
      settings.categories.includes(word.category) &&
      settings.difficulties.includes(word.difficulty)
  );
}

export function shuffleWords(words: Word[]): Word[] {
  const shuffled = [...words];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
} 