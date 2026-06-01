export function moveSourceImageItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
    const count = items.length;
    if (
        count === 0 ||
        !Number.isInteger(fromIndex) ||
        !Number.isInteger(toIndex) ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= count ||
        toIndex >= count ||
        fromIndex === toIndex
    ) {
        return [...items];
    }

    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
}

export function reorderSourceImageSelection<TFile, TPreview>(
    files: readonly TFile[],
    previewUrls: readonly TPreview[],
    fromIndex: number,
    toIndex: number
): { files: TFile[]; previewUrls: TPreview[] } {
    return {
        files: moveSourceImageItem(files, fromIndex, toIndex),
        previewUrls: moveSourceImageItem(previewUrls, fromIndex, toIndex)
    };
}
