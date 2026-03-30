/**
 * src/workers/index.ts
 *
 * Worker entry point for AI generation and social posting queues.
 * Each worker runs in the same process as the server; for horizontal
 * scaling, this file can be run as a standalone process via:
 *   node -r ts-node/register src/workers/index.ts
 */
import { Job, Worker } from 'bullmq';
import { trace } from '@opentelemetry/api';
import { queueManager } from '../queues/queueManager';
import { AI_QUEUE_NAME, AIJobData, AIJobType } from '../queues/aiQueue';
import { SOCIAL_QUEUE_NAME, SocialJobData, SocialJobType } from '../queues/socialQueue';
import { aiService } from '../services/AIService';
import { translationService } from '../services/TranslationService';
import { prisma } from '../lib/prisma';
import { createLogger } from '../lib/logger';

const logger = createLogger('workers');

// ── helpers ───────────────────────────────────────────────────────────────────

function currentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (!span) return undefined;
  const id = span.spanContext().traceId;
  return id === '00000000000000000000000000000000' ? undefined : id;
}

async function persistAIResult(
  job: Job<AIJobData>,
  output: Record<string, unknown>,
): Promise<void> {
  await prisma.aIGenerationResult.create({
    data: {
      jobId: job.id!,
      userId: job.data.userId,
      organizationId: job.data.organizationId ?? null,
      jobType: job.data.type,
      output,
      traceId: currentTraceId() ?? null,
    },
  });
}

// ── AI generation processors ─────────────────────────────────────────────────

const aiProcessors: Record<AIJobType, (job: Job<AIJobData>) => Promise<unknown>> = {
  'generate-caption': async (job) => {
    const { prompt, options, userId } = job.data;
    const platform = (options?.platform as string) ?? 'general';
    const tone = (options?.tone as string) ?? 'professional';
    logger.info('Generating caption', { jobId: job.id, userId });

    const caption = await aiService.generateCaption(prompt, platform, tone);
    const output = { caption, generatedAt: new Date().toISOString() };
    await persistAIResult(job, output);
    return output;
  },

  'generate-hashtags': async (job) => {
    const { prompt, options, userId } = job.data;
    const platform = (options?.platform as string) ?? 'general';
    logger.info('Generating hashtags', { jobId: job.id, userId });

    const raw = await aiService.generateContent(
      `Generate 5–10 relevant hashtags for a ${platform} post about: "${prompt}". Return only the hashtags, one per line, each starting with #.`,
      `#${platform} #content #update`,
      userId,
    );
    const hashtags = raw
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.startsWith('#'));
    const output = { hashtags, generatedAt: new Date().toISOString() };
    await persistAIResult(job, output);
    return output;
  },

  'generate-content': async (job) => {
    const { prompt, options, userId } = job.data;
    logger.info('Generating content', { jobId: job.id, userId });

    const content = await aiService.generateContent(prompt, undefined, userId);
    const output = { content, generatedAt: new Date().toISOString() };
    await persistAIResult(job, output);
    return output;
  },

  'analyze-sentiment': async (job) => {
    const { prompt, userId } = job.data;
    logger.info('Analysing sentiment', { jobId: job.id, userId });

    const analysis = await aiService.analyzeContent(prompt);
    const output = { ...analysis, analysedAt: new Date().toISOString() };
    await persistAIResult(job, output);
    return output;
  },

  'translate-content': async (job) => {
    const { prompt, options, userId } = job.data;
    const targetLanguages = (options?.targetLanguages as string[]) ?? ['en'];
    logger.info('Translating content', { jobId: job.id, userId });

    const result = await translationService.translate({
      text: prompt,
      targetLanguages,
      sourceLanguage: (options?.sourceLanguage as string) ?? undefined,
    });
    const output = { ...result, translatedAt: new Date().toISOString() };
    await persistAIResult(job, output);
    return output;
  },
};

// ── Social posting processors ─────────────────────────────────────────────────

const socialProcessors: Record<SocialJobType, (job: Job<SocialJobData>) => Promise<unknown>> = {
  'publish-post': async (job) => {
    const { platform, userId, payload } = job.data;
    logger.info('Publishing post', { jobId: job.id, platform, userId });
    // TODO: wire to platform service (TwitterService, FacebookService, etc.)
    return { postId: null, platform, publishedAt: new Date().toISOString() };
  },
  'schedule-post': async (job) => {
    const { platform, userId, payload } = job.data;
    logger.info('Scheduling post', { jobId: job.id, platform, userId, scheduledAt: payload.scheduledAt });
    // TODO: wire to platform service with scheduledAt
    return { postId: null, platform, scheduledAt: payload.scheduledAt };
  },
  'delete-post': async (job) => {
    const { platform, userId, payload } = job.data;
    logger.info('Deleting post', { jobId: job.id, platform, userId, postId: payload.postId });
    // TODO: wire to platform service delete
    return { deleted: true, platform, postId: payload.postId };
  },
  'sync-analytics': async (job) => {
    const { platform, userId } = job.data;
    logger.info('Syncing analytics', { jobId: job.id, platform, userId });
    // TODO: wire to AnalyticsService.sync(platform, userId)
    return { synced: true, platform, syncedAt: new Date().toISOString() };
  },
};

// ── Worker factory ────────────────────────────────────────────────────────────

function createAIWorker(): Worker<AIJobData> {
  const worker = queueManager.createWorker(
    AI_QUEUE_NAME,
    async (job: Job<AIJobData>) => {
      const processor = aiProcessors[job.data.type];
      if (!processor) {
        throw new Error(`Unknown AI job type: ${job.data.type}`);
      }
      return processor(job);
    },
    { concurrency: 5 }, // AI calls are I/O-bound; 5 concurrent is safe
  ) as Worker<AIJobData>;

  worker.on('failed', (job, err) => {
    logger.error('AI job failed', {
      jobId: job?.id,
      type: job?.data.type,
      userId: job?.data.userId,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts.attempts,
      error: err.message,
      movedToDeadLetter: job?.attemptsMade === job?.opts.attempts,
    });
  });

  return worker;
}

function createSocialWorker(): Worker<SocialJobData> {
  return queueManager.createWorker(
    SOCIAL_QUEUE_NAME,
    async (job: Job<SocialJobData>) => {
      const processor = socialProcessors[job.data.type];
      if (!processor) {
        throw new Error(`Unknown social job type: ${job.data.type}`);
      }
      return processor(job);
    },
    { concurrency: 3 }, // Lower concurrency to respect platform rate limits
  ) as Worker<SocialJobData>;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export function startWorkers(): { ai: Worker<AIJobData>; social: Worker<SocialJobData> } {
  const ai = createAIWorker();
  const social = createSocialWorker();
  logger.info('AI and social workers started', {
    queues: [AI_QUEUE_NAME, SOCIAL_QUEUE_NAME],
  });
  return { ai, social };
}
