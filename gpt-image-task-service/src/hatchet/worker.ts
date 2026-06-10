import { createManagedImageWorker, hasHatchetToken } from './live.js';

if (import.meta.url === `file://${process.argv[1]}`) {
    if (!hasHatchetToken()) {
        console.error('HATCHET_CLIENT_TOKEN is required to start the live Hatchet worker.');
        process.exit(2);
    }

    const worker = await createManagedImageWorker();
    console.log(
        JSON.stringify(
            {
                worker: 'starting',
                name: worker.name
            },
            null,
            2
        )
    );
    await worker.start();
}
