import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const referenceType = pgTable("reference_types", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
});
export const referenceValue = pgTable(
  "reference_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type")
      .notNull()
      .references(() => referenceType.code),
    code: text("code").notNull(),
    label: text("label").notNull(),
  },
  (table) => [
    uniqueIndex("reference_values_type_code_idx").on(table.type, table.code),
  ],
);
