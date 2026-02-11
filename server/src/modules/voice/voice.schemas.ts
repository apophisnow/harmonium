import { z } from 'zod';

export const joinSchema = z.object({
  channelId: z.string().min(1, 'channelId is required'),
});

export const connectTransportSchema = z.object({
  channelId: z.string().min(1, 'channelId is required'),
  transportId: z.string().min(1, 'transportId is required'),
  dtlsParameters: z.object({
    role: z.enum(['auto', 'client', 'server']).optional(),
    fingerprints: z.array(
      z.object({
        algorithm: z.string(),
        value: z.string(),
      }),
    ),
  }),
});

export const produceSchema = z.object({
  channelId: z.string().min(1, 'channelId is required'),
  transportId: z.string().min(1, 'transportId is required'),
  kind: z.enum(['audio', 'video']),
  rtpParameters: z.object({
    mid: z.string().optional(),
    codecs: z.array(z.any()),
    headerExtensions: z.array(z.any()).optional(),
    encodings: z.array(z.any()).optional(),
    rtcp: z.any().optional(),
  }),
});

export const consumeSchema = z.object({
  channelId: z.string().min(1, 'channelId is required'),
  producerId: z.string().min(1, 'producerId is required'),
  rtpCapabilities: z.object({
    codecs: z.array(z.any()).optional(),
    headerExtensions: z.array(z.any()).optional(),
  }),
});

export const leaveSchema = z.object({
  channelId: z.string().min(1, 'channelId is required'),
});

export const serverParamsSchema = z.object({
  serverId: z.string().min(1, 'serverId is required'),
});

export type JoinInput = z.infer<typeof joinSchema>;
export type ConnectTransportInput = z.infer<typeof connectTransportSchema>;
export type ProduceInput = z.infer<typeof produceSchema>;
export type ConsumeInput = z.infer<typeof consumeSchema>;
export type LeaveInput = z.infer<typeof leaveSchema>;
