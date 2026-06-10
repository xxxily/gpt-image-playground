type ProbeResult = {
    sdkLoaded: boolean;
    tokenConfigured: boolean;
    tlsStrategy?: string;
    notes: string[];
};

export async function probeHatchetAdapter(): Promise<ProbeResult> {
    const notes: string[] = [];
    try {
        await import('@hatchet-dev/typescript-sdk');
        notes.push('Loaded @hatchet-dev/typescript-sdk successfully.');
    } catch (error) {
        notes.push(error instanceof Error ? error.message : 'Unknown Hatchet SDK load error.');
        return {
            sdkLoaded: false,
            tokenConfigured: Boolean(process.env.HATCHET_CLIENT_TOKEN),
            tlsStrategy: process.env.HATCHET_CLIENT_TLS_STRATEGY,
            notes
        };
    }

    if (!process.env.HATCHET_CLIENT_TOKEN) {
        notes.push('HATCHET_CLIENT_TOKEN is not configured; skipping live control-plane connection.');
    }
    if (process.env.HATCHET_CLIENT_TLS_STRATEGY) {
        notes.push(`HATCHET_CLIENT_TLS_STRATEGY=${process.env.HATCHET_CLIENT_TLS_STRATEGY}`);
    }

    return {
        sdkLoaded: true,
        tokenConfigured: Boolean(process.env.HATCHET_CLIENT_TOKEN),
        tlsStrategy: process.env.HATCHET_CLIENT_TLS_STRATEGY,
        notes
    };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const result = await probeHatchetAdapter();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.sdkLoaded ? 0 : 1);
}
