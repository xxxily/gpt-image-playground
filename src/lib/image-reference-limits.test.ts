import {
    BYTES_PER_MEGABYTE,
    getImageReferenceConstraints,
    validateImageReferenceDimensions,
    validateImageReferenceFiles,
    type ImageReferenceFileLike
} from './image-reference-limits';
import { GEMINI_NANO_BANANA_2_MODEL, SEEDREAM_5_LITE_MODEL, SEEDREAM_5_MODEL } from './model-registry';
import { describe, expect, it } from 'vitest';

function imageFile(name: string, sizeMb: number, type = ''): ImageReferenceFileLike {
    return {
        name,
        size: sizeMb * BYTES_PER_MEGABYTE,
        type
    };
}

describe('image reference model limits', () => {
    it('allows gpt-image-2 to use 16 PNG/JPEG/WebP references up to 50MB each', () => {
        const constraints = getImageReferenceConstraints('gpt-image-2');

        expect(constraints.maxImages).toBe(16);
        expect(constraints.maxFileBytes).toBe(50 * BYTES_PER_MEGABYTE);
        expect(constraints.allowedMimeTypes).toEqual(['image/png', 'image/jpeg', 'image/webp']);

        expect(
            validateImageReferenceFiles(
                Array.from({ length: 16 }, (_, index) => imageFile(`ref-${index}.png`, 49, 'image/png')),
                constraints
            )
        ).toEqual({ valid: true });
        expect(validateImageReferenceFiles([imageFile('too-large.png', 51, 'image/png')], constraints)).toMatchObject({
            valid: false,
            issue: { code: 'file_too_large' }
        });
    });

    it('applies Seedream reference format, size, pixel, ratio, and count limits', () => {
        const constraints = getImageReferenceConstraints(SEEDREAM_5_MODEL);

        expect(constraints.maxImages).toBe(14);
        expect(constraints.maxFileBytes).toBe(30 * BYTES_PER_MEGABYTE);
        expect(constraints.allowedMimeTypes).toContain('image/heic');
        expect(validateImageReferenceFiles([imageFile('ref.heic', 10)], constraints)).toEqual({ valid: true });
        expect(validateImageReferenceDimensions({ width: 6000, height: 6001 }, constraints, 'large.png')).toMatchObject(
            {
                code: 'pixel_count_too_large'
            }
        );
        expect(validateImageReferenceDimensions({ width: 224, height: 14 }, constraints, 'thin.png')).toMatchObject({
            code: 'short_side_too_small'
        });
        expect(validateImageReferenceDimensions({ width: 1700, height: 100 }, constraints, 'wide.png')).toMatchObject({
            code: 'aspect_ratio_out_of_range'
        });
    });

    it('reduces Seedream 5.0 Lite reference capacity by requested output image count', () => {
        const constraints = getImageReferenceConstraints(SEEDREAM_5_LITE_MODEL, { outputCount: 4 });

        expect(constraints.maxImages).toBe(11);
        expect(constraints.combinedImageCountLimit).toBe(15);
        expect(
            validateImageReferenceFiles(
                Array.from({ length: 12 }, (_, index) => imageFile(`ref-${index}.png`, 1, 'image/png')),
                constraints
            )
        ).toMatchObject({
            valid: false,
            issue: {
                code: 'too_many_images',
                maxImages: 11,
                combinedImageCountLimit: 15,
                outputCount: 4
            }
        });
    });

    it('uses Gemini Nano Banana 2 14-reference and 20MB total inline limits', () => {
        const constraints = getImageReferenceConstraints(GEMINI_NANO_BANANA_2_MODEL);

        expect(constraints.maxImages).toBe(14);
        expect(constraints.maxFileBytes).toBe(20 * BYTES_PER_MEGABYTE);
        expect(constraints.maxTotalBytes).toBe(20 * BYTES_PER_MEGABYTE);
        expect(constraints.allowedMimeTypes).toEqual([
            'image/png',
            'image/jpeg',
            'image/webp',
            'image/heic',
            'image/heif'
        ]);
        expect(
            validateImageReferenceFiles(
                [imageFile('a.png', 12, 'image/png'), imageFile('b.png', 9, 'image/png')],
                constraints
            )
        ).toMatchObject({
            valid: false,
            issue: { code: 'total_too_large' }
        });
    });

    it('keeps unknown models on the conservative 10-reference default', () => {
        const constraints = getImageReferenceConstraints('unknown-image-model');

        expect(constraints.maxImages).toBe(10);
        expect(constraints.maxFileBytes).toBe(30 * BYTES_PER_MEGABYTE);
        expect(constraints.maxPixels).toBe(36_000_000);
        expect(validateImageReferenceFiles([imageFile('ref.gif', 1, 'image/gif')], constraints)).toMatchObject({
            valid: false,
            issue: { code: 'unsupported_type' }
        });
    });
});
