export function isGarbageOrgName(name: string): boolean {
  const value = name.trim();
  if (value.length < 4) return true;
  if (/^(.)\1{3,}$/.test(value)) return true;
  if (/asdf|qwerty|test123|111111|dummy|lorem/i.test(value)) return true;
  if (/^[0-9]{2,}/.test(value) && value.length < 16 && !/\s/.test(value)) return true;
  return false;
}
