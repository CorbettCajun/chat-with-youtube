import type { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

type SystemStatus = {
  openai: {
    status: 'ok' | 'error' | 'unknown';
    message?: string;
    lastCheck: string;
  };
  pinecone: {
    status: 'ok' | 'error' | 'unknown';
    message?: string;
    indexStats?: {
      dimensions: number;
      totalVectorCount: number;
      indexFullness: number;
    };
    lastCheck: string;
  };
  system: {
    uptime: string;
    memoryUsage: {
      used: string;
      total: string;
      percentage: number;
    };
    dockerStats: {
      cpu: string;
      memory: string;
      network: string;
    };
  };
};

type APIStatus = {
  status: 'ok' | 'error';
  lastCheck: string;
  error?: string;
};

async function getSecrets() {
  const secretsDir = path.join(process.cwd(), '../secrets');
  try {
    const [openaiKey, pineconeKey, pineconeIndex] = await Promise.all([
      fs.readFile(path.join(secretsDir, 'openai_api_key.txt'), 'utf-8'),
      fs.readFile(path.join(secretsDir, 'pinecone_api_key.txt'), 'utf-8'),
      fs.readFile(path.join(secretsDir, 'pinecone_index.txt'), 'utf-8'),
    ]);
    return { openaiKey, pineconeKey, pineconeIndex };
  } catch (error) {
    console.error('Error reading secrets:', error);
    return null;
  }
}

async function checkOpenAI(apiKey: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('OpenAI API check failed');
    }

    return {
      status: 'ok' as const,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'error' as const,
      message: error.message,
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkPinecone(apiKey: string, indexName: string): Promise<APIStatus> {
  try {
    const pinecone = new Pinecone({
      apiKey,
      environment: 'gcp-starter',
    });

    const index = pinecone.index(indexName);
    await index.describeIndex();

    return {
      status: 'ok',
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'error',
      lastCheck: new Date().toISOString(),
      error: error.message,
    };
  }
}

async function getSystemStats() {
  try {
    // Get Docker container stats
    const { stdout: dockerStats } = await execAsync('docker stats --no-stream --format "{{.CPUPerc}};{{.MemUsage}};{{.NetIO}}" app');
    const [cpu, memUsage, netIO] = dockerStats.trim().split(';');

    // Get container uptime
    const { stdout: uptimeRaw } = await execAsync('docker inspect --format "{{.State.StartedAt}}" app');
    const startTime = new Date(uptimeRaw.trim());
    const uptime = formatUptime(Date.now() - startTime.getTime());

    // Parse memory usage
    const [used, total] = memUsage.split(' / ');
    const usedBytes = parseMemoryToBytes(used);
    const totalBytes = parseMemoryToBytes(total);
    const percentage = (usedBytes / totalBytes) * 100;

    return {
      uptime,
      memoryUsage: {
        used,
        total,
        percentage,
      },
      dockerStats: {
        cpu,
        memory: memUsage,
        network: netIO,
      },
    };
  } catch (error) {
    console.error('Error getting system stats:', error);
    return {
      uptime: 'Unknown',
      memoryUsage: {
        used: 'Unknown',
        total: 'Unknown',
        percentage: 0,
      },
      dockerStats: {
        cpu: 'Unknown',
        memory: 'Unknown',
        network: 'Unknown',
      },
    };
  }
}

function formatUptime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function parseMemoryToBytes(memory: string) {
  const value = parseFloat(memory);
  const unit = memory.replace(/[\d.]/g, '').trim().toLowerCase();
  const multipliers = {
    b: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,
  };
  return value * (multipliers[unit] || 1);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SystemStatus>
) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const secrets = await getSecrets();
  if (!secrets) {
    return res.status(500).json({
      openai: { status: 'unknown', lastCheck: new Date().toISOString() },
      pinecone: { status: 'unknown', lastCheck: new Date().toISOString() },
      system: await getSystemStats(),
    });
  }

  const [openaiStatus, pineconeStatus, systemStats] = await Promise.all([
    checkOpenAI(secrets.openaiKey),
    checkPinecone(secrets.pineconeKey, secrets.pineconeIndex),
    getSystemStats(),
  ]);

  res.json({
    openai: openaiStatus,
    pinecone: {
      status: pineconeStatus.status,
      message: pineconeStatus.error,
      lastCheck: pineconeStatus.lastCheck,
    },
    system: systemStats,
  });
}
