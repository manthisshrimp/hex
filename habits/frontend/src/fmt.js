export function fmtNum(n, decimals = 0) {
  if (n == null || isNaN(n)) return '0';
  const fixed = Number(n).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart !== undefined ? `${withSpaces}.${decPart}` : withSpaces;
}
