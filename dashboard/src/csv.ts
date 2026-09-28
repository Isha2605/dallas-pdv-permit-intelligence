/** Export original fields without rounding or deriving any metric. */
export function toCSV<T extends object>(rows: T[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]) as (keyof T)[];
  const escape = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    keys.map(escape).join(","),
    ...rows.map((row) => keys.map((key) => escape(row[key])).join(",")),
  ].join("\r\n");
}
