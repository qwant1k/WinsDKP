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

type BossTrackerState = {
  bosses: BossTrackerBoss[];
  nextId: number;
  updatedAt: number | null;
};

type TrackerBridge = {
  getState: () => { bosses: BossTrackerBoss[]; nextId: number };
  setState: (state: { bosses: BossTrackerBoss[]; nextId: number }) => void;
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

    if (!iframeWindow || !iframeDocument || !clanId) {
      setIsReady(true);
      return;
    }

    const bridge = iframeWindow.__bossTrackerBridge;
    if (!bridge) {
      setIsReady(true);
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
        const { bosses, nextId } = bridge.getState();
        const { data } = await api.post<BossTrackerState>(`/clans/${clanId}/boss-tracker/state`, { bosses, nextId });
        iframeWindow.__bossTrackerLastUpdatedAt = data.updatedAt;
      } catch {
        // Ignore transient save failures in UI layer.
      }
    };

    const applyState = (state: BossTrackerState) => {
      bridge.setState({ bosses: state.bosses, nextId: state.nextId });
      iframeWindow.__bossTrackerLastUpdatedAt = state.updatedAt;
    };

    const loadState = async (force = false) => {
      const { data } = await api.get<BossTrackerState>(`/clans/${clanId}/boss-tracker/state`);
      if (!data.updatedAt) return null;
      if (!force && iframeWindow.__bossTrackerLastUpdatedAt === data.updatedAt) return data;
      applyState(data);
      return data;
    };

    const remoteState = await loadState(true);
    const localState = bridge.getState();
    const hasCorruptedRemoteState = !!remoteState && remoteState.bosses.length === 0 && remoteState.nextId === 1 && localState.bosses.length > 0;
    if (!remoteState || hasCorruptedRemoteState) {
      await saveState();
    }

    if (iframeWindow.__bossTrackerPatched || typeof iframeWindow.showNotif !== 'function') {
      setIsReady(true);
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
      void loadState(false);
    }, 5000);

    iframeWindow.__bossTrackerPatched = true;
    if (typeof iframeWindow.render === 'function') {
      iframeWindow.render();
    }
    setIsReady(true);
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
