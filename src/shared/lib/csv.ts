export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index++;
      } else quoted = !quoted;
    } else if (char === ";" && !quoted) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSV com aspas não encerradas.");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((item) => item.some(Boolean));
}

export function csvCell(value: string) {
  return `"${(/^[=+\-@\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
}
