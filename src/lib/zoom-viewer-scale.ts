type ImageSize = {
    width: number;
    height: number;
};

type ViewportSize = {
    width: number;
    height: number;
};

type ZoomViewerFitScaleOptions = {
    desktopPadding?: number;
    mobileBreakpoint?: number;
    mobilePadding?: number;
};

const DEFAULT_DESKTOP_PADDING = 40;
const DEFAULT_MOBILE_BREAKPOINT = 768;
const DEFAULT_MOBILE_PADDING = 0;

export function getZoomViewerFitScale(
    imageSize: ImageSize,
    viewportSize: ViewportSize,
    options: ZoomViewerFitScaleOptions = {}
) {
    const isMobileViewport = Math.min(viewportSize.width, viewportSize.height) < (options.mobileBreakpoint ?? DEFAULT_MOBILE_BREAKPOINT);
    const padding = isMobileViewport ? options.mobilePadding ?? DEFAULT_MOBILE_PADDING : options.desktopPadding ?? DEFAULT_DESKTOP_PADDING;
    const availableWidth = Math.max(1, viewportSize.width - padding * 2);
    const availableHeight = Math.max(1, viewportSize.height - padding * 2);
    const fitScale = Math.min(availableWidth / imageSize.width, availableHeight / imageSize.height);

    if (!Number.isFinite(fitScale) || fitScale <= 0) return 1;

    return isMobileViewport ? fitScale : Math.min(fitScale, 1);
}
