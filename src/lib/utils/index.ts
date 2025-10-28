export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };

function resolve(input: ClassValue): string[] {
  if (!input) return [];
  if (typeof input === 'string' || typeof input === 'number') return [String(input)];
  if (Array.isArray(input)) return input.flatMap(resolve);
  if (typeof input === 'object') {
    return Object.entries(input)
      .filter(([, v]) => !!v)
      .map(([k]) => k);
  }
  return [];
}

export function cn(...classes: ClassValue[]): string {
  return classes.flatMap(resolve).join(' ');
}