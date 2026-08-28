export function splitDollarMath(input) {
  const parts = [];
  let cursor = 0;
  const pattern = /\$([^$\r\n]+?)\$/g;
  let match;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > cursor) {
      parts.push({ type: "text", value: input.slice(cursor, match.index) });
    }

    parts.push({
      type: "equation",
      source: match[1].trim(),
      original: match[0]
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < input.length) {
    parts.push({ type: "text", value: input.slice(cursor) });
  }

  return parts;
}
