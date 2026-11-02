/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs font-mono text-white shadow-2xl animate-pulse">
      <WifiOff className="w-3.5 h-3.5 text-white" />
      <span>Offline Mode — Service Worker Active</span>
    </div>
  );
};
