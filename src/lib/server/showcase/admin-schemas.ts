import { z } from 'zod';

const nullableDate = z.preprocess((value) => {
    if (value === '' || value === undefined) return undefined;
    if (value === null) return null;
    return value;
}, z.coerce.date().nullable().optional());

export const showcaseTopicWriteSchema = z.object({
    draft: z.unknown(),
    startsAt: nullableDate,
    endsAt: nullableDate
});

export const showcaseRollbackSchema = z.object({
    publicationId: z.string().trim().min(1).max(128)
});
