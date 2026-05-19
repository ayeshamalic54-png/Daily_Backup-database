import { pgTable, serial, integer, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  workingDaysPerMonth:     integer("working_days_per_month").notNull().default(26),
  absentPenaltyFraction:   decimal("absent_penalty_fraction",  { precision: 4, scale: 2 }).notNull().default("1.00"),
  latePenaltyFraction:     decimal("late_penalty_fraction",    { precision: 4, scale: 2 }).notNull().default("0.50"),
  leavePenaltyFraction:    decimal("leave_penalty_fraction",   { precision: 4, scale: 2 }).notNull().default("0.00"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, updatedAt: true });
export type Settings       = typeof settingsTable.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
