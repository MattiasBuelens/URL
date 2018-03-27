export default function includes(string: string, search: string, start: number = 0): boolean {
  return string.indexOf(search, start) !== -1;
}
