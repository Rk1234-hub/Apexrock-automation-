// ============================================================================
// APEXROCK AUTOMATION: PRIORITY PACKET DISPATCHER (ApexSendQueue)
// ============================================================================

import { PacketPriority } from '../types/apex';

export interface QueuedPacketItem {
  id: string;
  priority: PacketPriority;
  packet: Uint8Array;
  timestamp: number;
  commandId?: number;
  label?: string;
}

export class ApexSendQueue {
  private queues: Map<PacketPriority, QueuedPacketItem[]> = new Map([
    [PacketPriority.EMERGENCY, []],
    [PacketPriority.COMMAND, []],
    [PacketPriority.STREAM, []],
    [PacketPriority.BULK, []]
  ]);

  private priorityOrder: PacketPriority[] = [
    PacketPriority.EMERGENCY,
    PacketPriority.COMMAND,
    PacketPriority.STREAM,
    PacketPriority.BULK
  ];

  private stats = {
    [PacketPriority.EMERGENCY]: 0,
    [PacketPriority.COMMAND]: 0,
    [PacketPriority.STREAM]: 0,
    [PacketPriority.BULK]: 0,
    totalDispatched: 0
  };

  public enqueue(
    priority: PacketPriority,
    packet: Uint8Array,
    commandId?: number,
    label?: string
  ): QueuedPacketItem {
    const item: QueuedPacketItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      priority,
      packet,
      timestamp: Date.now(),
      commandId,
      label
    };

    const targetQueue = this.queues.get(priority);
    if (targetQueue) {
      targetQueue.push(item);
    }
    return item;
  }

  public pollNextPacket(): QueuedPacketItem | null {
    for (const priority of this.priorityOrder) {
      const q = this.queues.get(priority);
      if (q && q.length > 0) {
        const item = q.shift()!;
        this.stats[priority]++;
        this.stats.totalDispatched++;
        return item;
      }
    }
    return null;
  }

  public getQueueLengths(): Record<PacketPriority, number> {
    return {
      [PacketPriority.EMERGENCY]: this.queues.get(PacketPriority.EMERGENCY)?.length ?? 0,
      [PacketPriority.COMMAND]: this.queues.get(PacketPriority.COMMAND)?.length ?? 0,
      [PacketPriority.STREAM]: this.queues.get(PacketPriority.STREAM)?.length ?? 0,
      [PacketPriority.BULK]: this.queues.get(PacketPriority.BULK)?.length ?? 0
    };
  }

  public getStats() {
    return { ...this.stats };
  }

  public clearAll(): void {
    for (const priority of this.priorityOrder) {
      const q = this.queues.get(priority);
      if (q) q.length = 0;
    }
  }
}

// Global shared singleton instance
export const globalSendQueue = new ApexSendQueue();
