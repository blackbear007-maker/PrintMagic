/**
 * 🪄 MobileSAM / SAM 2.1 Forwarder (Segment Anything 2.1 - Apache 2.0 / ~38 MB)
 */

import { Sam2Segmenter, Sam2SpotFinishResult, Sam2PromptPoint } from './sam2-segmenter';

export type SpotFinishMask = Sam2SpotFinishResult;
export type { Sam2PromptPoint, Sam2SpotFinishResult };
export const MobileSamSegmenter = Sam2Segmenter;
