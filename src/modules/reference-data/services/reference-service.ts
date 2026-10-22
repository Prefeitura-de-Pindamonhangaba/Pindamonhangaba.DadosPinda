import type { createReferenceRepository } from "../models/reference-repository";
import { referenceMutationSchema } from "../schemas/reference-schema";

export function listReferences(
  repository: ReturnType<typeof createReferenceRepository>,
) {
  return repository.list();
}
export function mutateReferences(
  repository: ReturnType<typeof createReferenceRepository>,
  input: unknown,
  actorId: string,
) {
  return repository.mutate(referenceMutationSchema.parse(input), actorId);
}

export function parseReferenceCsv(text: string) {
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
  if (rows[0]?.join(";") !== "type;code;label")
    throw new Error(
      "Use o cabeçalho type;code;label e separador ponto e vírgula.",
    );
  return rows
    .slice(1)
    .filter((item) => item.some(Boolean))
    .map(([type, code, label]) => ({ type, code, label }));
}

export function exportReferenceCsv(
  values: { type: string; code: string; label: string }[],
) {
  const cell = (value: string) =>
    `"${(/^[=+\-@\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
  return (
    "\ufefftype;code;label\r\n" +
    values
      .map((value) => [value.type, value.code, value.label].map(cell).join(";"))
      .join("\r\n")
  );
}
