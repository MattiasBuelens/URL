export default function endsWith(string: string, search: string): boolean {
  return string.substr(string.length - search.length, search.length) === search;
}
