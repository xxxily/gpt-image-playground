'use client';

import * as React from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState(value);

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedValue(value);
        }, Math.max(0, delayMs));

        return () => window.clearTimeout(timer);
    }, [delayMs, value]);

    return debouncedValue;
}
