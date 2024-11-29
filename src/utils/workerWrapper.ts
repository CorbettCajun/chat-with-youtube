import { parentPort } from 'worker_threads';
import path from 'path';

if (!parentPort) {
  throw new Error('This module must be run as a worker thread!');
}

parentPort.on('message', async ({ taskId, scriptPath, data }) => {
  try {
    // Dynamically import the worker script
    const workerScript = await import(path.resolve(scriptPath));
    const result = await workerScript.default(data);

    parentPort!.postMessage({
      taskId,
      result,
    });
  } catch (error) {
    parentPort!.postMessage({
      taskId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
