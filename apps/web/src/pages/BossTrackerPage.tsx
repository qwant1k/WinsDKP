import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { getSocket } from '@/lib/socket';

type BossTrackerBoss = {
  id: number;
  name: string;
  location: string;
  respawnSeconds: number;
  killedAt: number | null;
  emoji: string;
};

type BossTrackerFloor = {
  id: number;
  name: string;
  bosses: BossTrackerBoss[];
};

type BossTrackerLocation = {
  id: number;
  name: string;
  floors: BossTrackerFloor[];
  bosses: BossTrackerBoss[];
};

type BossTrackerState = {
  bosses: BossTrackerBoss[];
  nextId: number;
  locations?: BossTrackerLocation[];
  nextLocationId?: number;
  nextFloorId?: number;
  nextBossId?: number;
  activeLocId?: number | null;
  updatedAt?: number | null;
};

type TrackerBridge = {
  getState: () => {
    bosses: BossTrackerBoss[];
    nextId: number;
    locations?: BossTrackerLocation[];
    nextLocationId?: number;
    nextFloorId?: number;
    nextBossId?: number;
    activeLocId?: number | null;
    updatedAt?: number | null;
  };
  setState: (state: {
    bosses: BossTrackerBoss[];
    nextId: number;
    locations?: BossTrackerLocation[];
    nextLocationId?: number;
    nextFloorId?: number;
    nextBossId?: number;
    activeLocId?: number | null;
    updatedAt?: number | null;
  }) => void;
  deleteBoss: (id: number) => void;
};

type TrackerWindow = Window & {
  render?: () => void;
  addBoss?: () => void;
  killBoss?: (id: number) => void;
  resetBoss?: (id: number) => void;
  showNotif?: (title: string, text: string, type: string) => void;
  __bossTrackerBridge?: TrackerBridge;
  __bossTrackerPatched?: boolean;
  __bossTrackerSyncTimer?: number;
  __bossTrackerLastUpdatedAt?: number | null;
  __bossTrackerLastSavedLocalUpdatedAt?: number | null;
};

type BossMessagePayload = {
  type: 'boss-notification';
  title: string;
  text: string;
  kind: 'alive' | 'dead' | string;
};

export function BossTrackerPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const clanId = useAuthStore((s) => s.user?.clanMembership?.clanId);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const handleMessage = (event: MessageEvent<BossMessagePayload>) => {
      if (event.data?.type !== 'boss-notification') return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const { title, text, kind } = event.data;
      socket.emit('clan:boss-notification', { title, text, kind });
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    return () => {
      const iframeWindow = iframeRef.current?.contentWindow as TrackerWindow | null;
      if (iframeWindow?.__bossTrackerSyncTimer) {
        clearInterval(iframeWindow.__bossTrackerSyncTimer);
      }
    };
  }, []);

  const handleLoad = useCallback(async () => {
    const iframeWindow = iframeRef.current?.contentWindow as TrackerWindow | null;
    const iframeDocument = iframeRef.current?.contentDocument;
    try {

      if (!iframeWindow || !iframeDocument || !clanId) {
        return;
      }

      const bridge = iframeWindow.__bossTrackerBridge;
      if (!bridge) {
        return;
      }

    const container = iframeDocument.querySelector('.container') as HTMLElement | null;
    if (container) {
      container.style.maxWidth = 'none';
    }

    if (!iframeDocument.getElementById('boss-tracker-delete-style')) {
      const style = iframeDocument.createElement('style');
      style.id = 'boss-tracker-delete-style';
      style.textContent = `
        /* Tracker tuning: hide legacy header and keep moderate readable scale */
        header {
          display: none !important;
        }
        .container {
          padding-top: 16px !important;
        }
        .container .boss-name,
        .container .respawn-time,
        .container .boss-location,
        .container .status-badge,
        .container .timer-unit,
        .container .boss-header-cell,
        .container .subtitle,
        .container .header-rune,
        .container .btn-main,
        .container .btn-add-location {
          font-size: 1.45em !important;
        }
        .container .timer-unit,
        .container .boss-header-cell,
        .container .subtitle,
        .container .header-rune {
          letter-spacing: 0.06em;
        }
        .btn-delete {
          background: transparent;
          border: 1px solid rgba(180, 180, 180, 0.35);
          color: #b0b0b0;
          font-family: 'Cinzel', serif;
          font-size: 14px;
          letter-spacing: 1px;
          padding: 8px 14px;
          cursor: pointer;
          text-transform: uppercase;
          transition: all 0.25s;
          white-space: nowrap;
          margin-left: 8px;
        }
        .btn-delete:hover {
          border-color: #d2d2d2;
          color: #e0e0e0;
          background: rgba(180, 180, 180, 0.08);
        }
      `;
      iframeDocument.head.appendChild(style);
    }

    const saveState = async () => {
      try {
        const state = bridge.getState();
        const localUpdatedAt = Number(state.updatedAt || 0);
        const { data } = await api.post<BossTrackerState>(`/clans/${clanId}/boss-tracker/state`, state);
        iframeWindow.__bossTrackerLastUpdatedAt = data.updatedAt;
        iframeWindow.__bossTrackerLastSavedLocalUpdatedAt = localUpdatedAt;
      } catch {
        // Ignore transient save failures in UI layer.
      }
    };

    const applyState = (state: BossTrackerState) => {
      bridge.setState(state);
      iframeWindow.__bossTrackerLastUpdatedAt = state.updatedAt;
      iframeWindow.__bossTrackerLastSavedLocalUpdatedAt = Number(state.updatedAt || 0);
    };

      const fetchRemoteState = async () => {
        try {
          const { data } = await api.get<BossTrackerState>(`/clans/${clanId}/boss-tracker/state`);
          if (!data.updatedAt) return null;
          return data;
        } catch {
          return null;
        }
      };

    const localState = bridge.getState();
    const remoteState = await fetchRemoteState();
    const localHasData = (localState.locations?.length ?? 0) > 0 || localState.bosses.length > 0;
    const remoteHasData = !!remoteState && (((remoteState.locations?.length ?? 0) > 0) || remoteState.bosses.length > 0);

    if (!remoteHasData && localHasData) {
      await saveState();
    } else if (remoteHasData && !localHasData) {
      applyState(remoteState);
    } else if (remoteHasData && localHasData) {
      const localUpdatedAt = Number(localState.updatedAt || 0);
      const remoteUpdatedAt = Number(remoteState.updatedAt || 0);
      if (remoteUpdatedAt > localUpdatedAt) {
        applyState(remoteState);
      } else if (localUpdatedAt > 0) {
        await saveState();
      }
    }

    iframeWindow.__bossTrackerLastSavedLocalUpdatedAt = Number(
      iframeWindow.__bossTrackerLastSavedLocalUpdatedAt || bridge.getState().updatedAt || 0,
    );

      if (iframeWindow.__bossTrackerPatched || typeof iframeWindow.showNotif !== 'function') {
        return;
      }

    const originalAddBoss = iframeWindow.addBoss?.bind(iframeWindow);
    const originalKillBoss = iframeWindow.killBoss?.bind(iframeWindow);
    const originalResetBoss = iframeWindow.resetBoss?.bind(iframeWindow);
    const originalRender = iframeWindow.render?.bind(iframeWindow);
    const originalShowNotif = iframeWindow.showNotif.bind(iframeWindow);

    if (originalRender) {
      iframeWindow.render = () => {
        originalRender();

        const rows = iframeDocument.querySelectorAll('.boss-row');
        rows.forEach((row) => {
          const rowId = row.getAttribute('id') || '';
          const idMatch = rowId.match(/^row-(\d+)$/);
          if (!idMatch) return;
          const bossId = Number(idMatch[1]);

          const actionCells = row.querySelectorAll('.boss-cell');
          const actionCell = actionCells.length >= 5 ? actionCells[4] : null;
          if (!actionCell) return;
          if (actionCell.querySelector('.btn-delete')) return;

          const deleteBtn = iframeDocument.createElement('button');
          deleteBtn.className = 'btn-delete';
          deleteBtn.textContent = 'Удалить';
          deleteBtn.onclick = () => {
            bridge.deleteBoss(bossId);
            void saveState();
          };
          actionCell.appendChild(deleteBtn);
        });
      };
    }

    if (originalAddBoss) {
      iframeWindow.addBoss = () => {
        originalAddBoss();
        void saveState();
      };
    }

    if (originalKillBoss) {
      iframeWindow.killBoss = (id: number) => {
        originalKillBoss(id);
        void saveState();
      };
    }

    if (originalResetBoss) {
      iframeWindow.resetBoss = (id: number) => {
        originalResetBoss(id);
        void saveState();
      };
    }

    iframeWindow.showNotif = (title: string, text: string, type: string) => {
      originalShowNotif(title, text, type);
      void saveState();
    };

    if (iframeWindow.__bossTrackerSyncTimer) {
      clearInterval(iframeWindow.__bossTrackerSyncTimer);
    }

    iframeWindow.__bossTrackerSyncTimer = window.setInterval(() => {
      void (async () => {
        const localUpdatedAt = Number(bridge.getState().updatedAt || 0);
        const lastSavedLocalUpdatedAt = Number(iframeWindow.__bossTrackerLastSavedLocalUpdatedAt || 0);

        // Persist local mutations first to avoid remote poll overwriting unsaved state.
        if (localUpdatedAt > lastSavedLocalUpdatedAt) {
          await saveState();
          return;
        }

        const data = await fetchRemoteState();
        if (!data) return;
        if (iframeWindow.__bossTrackerLastUpdatedAt === data.updatedAt) return;
        const remoteUpdatedAt = Number(data.updatedAt || 0);
        if (remoteUpdatedAt <= localUpdatedAt) return;
        applyState(data);
      })();
    }, 5000);

      iframeWindow.__bossTrackerPatched = true;
      if (typeof iframeWindow.render === 'function') {
        iframeWindow.render();
      }
    } finally {
      setIsReady(true);
    }
  }, [clanId]);

  return (
    <div className="relative -mx-4 -my-6 sm:-mx-6 sm:-my-8">
      {!isReady && <div className="absolute inset-0 z-10 bg-background" />}
      <iframe
        ref={iframeRef}
        title="Boss Tracker"
        src="/boss-tracker.html"
        onLoad={() => {
          setIsReady(false);
          void handleLoad();
        }}
        className={`h-[calc(100vh-4.5rem)] w-full border-0 transition-opacity duration-150 ${isReady ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
