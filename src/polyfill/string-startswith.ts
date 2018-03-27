export default function startsWith(string: string, search: string): boolean {
  return string.substr(0, search.length) === search;
}
