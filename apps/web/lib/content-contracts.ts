import { z } from "zod";

export const locales = ["ko", "en"] as const;
export const publicationStatuses = ["published", "draft"] as const;

export const localeSchema = z.enum(locales);
export const publicationStatusSchema = z.enum(publicationStatuses);
export const isoDateSchema = z.iso.date();

export type Locale = z.infer<typeof localeSchema>;
export type PublicationStatus = z.infer<typeof publicationStatusSchema>;

export const nonEmptyTrimmedStringSchema = z.string().trim().min(1);

export function uniqueStringArraySchema(
    field: string,
    options: { readonly allowEmpty?: boolean } = {},
) {
    const arraySchema = z.array(z.string());
    return (
        options.allowEmpty === true
            ? arraySchema
            : arraySchema.min(
                  1,
                  `Metadata field "${field}" must be an array of strings.`,
              )
    )
        .transform((values) => values.map((value) => value.trim()))
        .superRefine((values, context) => {
            if (values.some((value) => value.length === 0)) {
                context.addIssue({
                    code: "custom",
                    message: `Metadata field "${field}" must not contain empty strings.`,
                });
            }
            if (new Set(values).size !== values.length) {
                context.addIssue({
                    code: "custom",
                    message: `Metadata field "${field}" must not contain duplicates.`,
                });
            }
        })
        .transform((values) => Object.freeze(values));
}

export const credentialFreeHttpsUrlSchema = z
    .string()
    .trim()
    .superRefine((value, context) => {
        let url: URL;
        try {
            url = new URL(value);
        } catch {
            context.addIssue({
                code: "custom",
                message: "must be an absolute URL.",
            });
            return;
        }
        if (
            url.protocol !== "https:" ||
            url.username !== "" ||
            url.password !== ""
        ) {
            context.addIssue({
                code: "custom",
                message: "must be a credential-free HTTPS URL.",
            });
        }
    });

export function isLocale(value: unknown): value is Locale {
    return localeSchema.safeParse(value).success;
}
