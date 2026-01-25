import type { PreflightCheck } from '@ignite/shared';
import { getImageInfo } from '../runtime/docker-runtime.js';

const DEFAULT_IMAGE_SIZE_WARN_MB = 500;
const DEFAULT_IMAGE_SIZE_FAIL_MB = 1000;

export interface ImagePreflightConfig {
  warnMb?: number;
  failMb?: number;
}

export async function analyzeImage(
  imageName: string,
  config?: ImagePreflightConfig
): Promise<PreflightCheck> {
  const imageInfo = await getImageInfo(imageName);
  const warnThresholdMb = config?.warnMb ?? DEFAULT_IMAGE_SIZE_WARN_MB;
  const failThresholdMb = config?.failMb ?? DEFAULT_IMAGE_SIZE_FAIL_MB;

  if (!imageInfo) {
    return {
      name: 'image-size',
      status: 'fail',
      message: `Image "${imageName}" not found. Build the image first.`,
    };
  }

  const sizeMb = Math.round(imageInfo.size / 1024 / 1024);

  if (sizeMb > failThresholdMb) {
    return {
      name: 'image-size',
      status: 'fail',
      message: `Image size ${sizeMb}MB exceeds ${failThresholdMb}MB limit`,
      value: sizeMb,
      threshold: failThresholdMb,
    };
  }

  if (sizeMb > warnThresholdMb) {
    return {
      name: 'image-size',
      status: 'warn',
      message: `Image size ${sizeMb}MB exceeds recommended ${warnThresholdMb}MB`,
      value: sizeMb,
      threshold: warnThresholdMb,
    };
  }

  return {
    name: 'image-size',
    status: 'pass',
    message: `Image size ${sizeMb}MB is within limits`,
    value: sizeMb,
    threshold: warnThresholdMb,
  };
}
