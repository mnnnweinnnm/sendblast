const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

let queues = {};

const getQueue = (name) => {
  if (!queues[name]) {
    queues[name] = new Queue(name, { connection });
  }
  return queues[name];
};

const createWorker = (name, processorFn) => {
  return new Worker(name, processorFn, { connection });
};

module.exports = { getQueue, createWorker, connection };
