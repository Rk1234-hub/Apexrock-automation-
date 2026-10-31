// ============================================================================
// APEXROCK AUTOMATION: 60 FPS LTTB TELEMETRY DECIMATOR
// Largest Triangle Three Buckets (LTTB) algorithm
// Downsamples high-rate telemetry (e.g. 1000-5000 pts) to pixel threshold (e.g. 150-300 pts)
// while strictly preserving local peaks, valleys, and visual frequency envelope.
// ============================================================================

import { TelemetryPoint } from '../types/apex';

export class ApexLttbDecimator {
  /**
   * Downsamples a list of TelemetryPoints using LTTB downsampling
   * @param data Raw input telemetry points
   * @param threshold Target downsample count (must be > 2)
   */
  public static decimate(data: TelemetryPoint[], threshold: number): TelemetryPoint[] {
    if (threshold >= data.length || threshold <= 2 || data.length === 0) {
      return data;
    }

    const sampled: TelemetryPoint[] = new Array(threshold);
    const bucketSize = (data.length - 2) / (threshold - 2);

    // Always keep the very first point
    sampled[0] = data[0];
    let lastIndex = 0;

    for (let i = 0; i < threshold - 2; i++) {
      // Calculate average point for the NEXT bucket (bucket C)
      const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
      const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);

      let avgX = 0;
      let avgY = 0;
      for (let j = rangeStart; j < rangeEnd; j++) {
        avgX += data[j].x;
        avgY += data[j].y;
      }
      const len = rangeEnd - rangeStart;
      if (len > 0) {
        avgX /= len;
        avgY /= len;
      }

      // Point A is the previously selected point (data[lastIndex])
      const refX = data[lastIndex].x;
      const refY = data[lastIndex].y;

      // Find the point in current bucket B that maximizes triangle area with A and C
      const currentBucketStart = Math.floor(i * bucketSize) + 1;
      const currentBucketEnd = rangeStart;

      let maxArea = -1;
      let maxIdx = currentBucketStart;

      for (let j = currentBucketStart; j < currentBucketEnd; j++) {
        if (j >= data.length) break;
        // Area of triangle formed by (refX, refY), (data[j].x, data[j].y), and (avgX, avgY)
        const area = Math.abs(
          (refX - avgX) * (data[j].y - refY) - (refX - data[j].x) * (avgY - refY)
        ) * 0.5;

        if (area > maxArea) {
          maxArea = area;
          maxIdx = j;
        }
      }

      sampled[i + 1] = data[maxIdx];
      lastIndex = maxIdx;
    }

    // Always keep the very last point
    sampled[threshold - 1] = data[data.length - 1];
    return sampled;
  }
}
