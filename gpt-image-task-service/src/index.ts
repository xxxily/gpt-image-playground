import { createTaskServiceServer } from './server.js';

const port = Number.parseInt(process.env.TASK_SERVICE_PORT ?? '8787', 10);
const baseUrl = process.env.TASK_SERVICE_BASE_URL ?? `http://localhost:${port}`;

const server = createTaskServiceServer({ baseUrl });

server.listen(port, () => {
    console.log(`gpt-image-task-service listening on ${baseUrl}`);
});

process.on('SIGTERM', () => {
    server.close(() => {
        process.exit(0);
    });
});
