import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  phone_number: z
    .string()
    .describe("Phone number associated with the chapter")
    .optional(),
  assigned_user_count: z
    .number()
    .int()
    .describe("Count of users assigned to this phone number")
    .optional(),
  chapters: z
    .array(
      z.object({
        id: z.number().int().optional(),
        name: z.string().optional(),
        logo_url: z.string().nullable().optional(),
        organization_id: z.number().int().optional(),
        chapter_phone_number: z.string().optional(),
      }),
    )
    .describe("Chapters associated with this phone number")
    .optional(),
  created_at: z
    .string()
    .datetime({ offset: true })
    .describe("The date and time when the ChapterPhoneNumber was created")
    .optional(),
});
