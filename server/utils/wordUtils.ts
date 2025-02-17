import words from '../data/words.json';

interface Word {
  word: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export function getWords(settings: {
  categories: string[];
  difficulties: ('easy' | 'medium' | 'hard')[];
}): Word[] {
  return words.filter(
    (word: Word) =>
      settings.categories.includes(word.category) &&
      settings.difficulties.includes(word.difficulty)
  );
}

export function shuffleWords(words: Word[]): Word[] {
  return [...words].sort(() => Math.random() - 0.5);
} 