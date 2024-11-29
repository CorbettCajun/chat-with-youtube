import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import path from 'path';
import { performance } from 'perf_hooks';

interface WorkerPoolOptions {
  minWorkers?: number;
  maxWorkers?: number;
  idleTimeout?: number;
  taskTimeout?: number;
}

interface WorkerTask {
  id: string;
  type: string;
  data: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  startTime: number;
}

interface WorkerMetrics {
  activeWorkers: number;
  idleWorkers: number;
  completedTasks: number;
  failedTasks: number;
  averageProcessingTime: number;
  totalProcessingTime: number;
}

export class WorkerPool extends EventEmitter {
  private workers: Worker[] = [];
  private idleWorkers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private workerScripts: Map<string, string> = new Map();
  private metrics: {
    completedTasks: number;
    failedTasks: number;
    totalProcessingTime: number;
  };

  constructor(private options: WorkerPoolOptions = {}) {
    super();
    this.options = {
      minWorkers: options.minWorkers || 2,
      maxWorkers: options.maxWorkers || 4,
      idleTimeout: options.idleTimeout || 60000, // 1 minute
      taskTimeout: options.taskTimeout || 30000,  // 30 seconds
    };

    this.metrics = {
      completedTasks: 0,
      failedTasks: 0,
      totalProcessingTime: 0,
    };

    this.initialize();
  }

  private async initialize() {
    // Create initial worker pool
    for (let i = 0; i < this.options.minWorkers!; i++) {
      await this.createWorker();
    }

    // Setup periodic cleanup
    setInterval(() => this.cleanupIdleWorkers(), this.options.idleTimeout);
  }

  registerWorkerScript(type: string, scriptPath: string) {
    this.workerScripts.set(type, scriptPath);
  }

  private async createWorker(): Promise<Worker> {
    const worker = new Worker(path.join(__dirname, 'workerWrapper.js'));

    worker.on('message', ({ taskId, result, error }) => {
      const task = this.taskQueue.find(t => t.id === taskId);
      if (task) {
        const processingTime = performance.now() - task.startTime;
        this.metrics.totalProcessingTime += processingTime;

        if (error) {
          this.metrics.failedTasks++;
          task.reject(error);
        } else {
          this.metrics.completedTasks++;
          task.resolve(result);
        }

        this.taskQueue = this.taskQueue.filter(t => t.id !== taskId);
        this.idleWorkers.push(worker);
        this.processNextTask();
      }
    });

    worker.on('error', (error) => {
      console.error('Worker error:', error);
      this.handleWorkerError(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
      }
      this.handleWorkerExit(worker);
    });

    this.idleWorkers.push(worker);
    return worker;
  }

  private async processNextTask() {
    if (this.taskQueue.length === 0 || this.idleWorkers.length === 0) {
      return;
    }

    const task = this.taskQueue[0];
    const worker = this.idleWorkers.pop()!;

    const scriptPath = this.workerScripts.get(task.type);
    if (!scriptPath) {
      task.reject(new Error(`No worker script registered for task type: ${task.type}`));
      return;
    }

    worker.postMessage({
      taskId: task.id,
      scriptPath,
      data: task.data,
    });

    // Setup task timeout
    setTimeout(() => {
      const taskIndex = this.taskQueue.findIndex(t => t.id === task.id);
      if (taskIndex !== -1) {
        const task = this.taskQueue[taskIndex];
        this.taskQueue.splice(taskIndex, 1);
        this.metrics.failedTasks++;
        task.reject(new Error('Task timeout'));
        this.handleWorkerError(worker);
      }
    }, this.options.taskTimeout);
  }

  private handleWorkerError(worker: Worker) {
    this.removeWorker(worker);
    this.createWorker().catch(console.error);
  }

  private handleWorkerExit(worker: Worker) {
    this.removeWorker(worker);
    if (this.workers.length < this.options.minWorkers!) {
      this.createWorker().catch(console.error);
    }
  }

  private removeWorker(worker: Worker) {
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex !== -1) {
      this.workers.splice(workerIndex, 1);
    }

    const idleIndex = this.idleWorkers.indexOf(worker);
    if (idleIndex !== -1) {
      this.idleWorkers.splice(idleIndex, 1);
    }
  }

  private cleanupIdleWorkers() {
    while (
      this.workers.length > this.options.minWorkers! &&
      this.idleWorkers.length > 0
    ) {
      const worker = this.idleWorkers.pop();
      if (worker) {
        worker.terminate();
        this.removeWorker(worker);
      }
    }
  }

  async executeTask<T>(type: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        data,
        resolve,
        reject,
        startTime: performance.now(),
      };

      this.taskQueue.push(task);

      // Create new worker if needed and possible
      if (
        this.idleWorkers.length === 0 &&
        this.workers.length < this.options.maxWorkers!
      ) {
        this.createWorker().catch(console.error);
      }

      this.processNextTask();
    });
  }

  getMetrics(): WorkerMetrics {
    return {
      activeWorkers: this.workers.length - this.idleWorkers.length,
      idleWorkers: this.idleWorkers.length,
      completedTasks: this.metrics.completedTasks,
      failedTasks: this.metrics.failedTasks,
      averageProcessingTime:
        this.metrics.totalProcessingTime /
        (this.metrics.completedTasks + this.metrics.failedTasks),
      totalProcessingTime: this.metrics.totalProcessingTime,
    };
  }

  async shutdown() {
    // Wait for pending tasks
    while (this.taskQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Terminate all workers
    await Promise.all(
      this.workers.map(worker => worker.terminate())
    );

    this.workers = [];
    this.idleWorkers = [];
  }
}
