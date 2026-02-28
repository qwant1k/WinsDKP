type ChampionNicknameProps = {
  nickname?: string | null;
  isChampion?: boolean | null;
  className?: string;
};

export function ChampionNickname({ nickname, isChampion, className }: ChampionNicknameProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className || ''}`.trim()}>
      {isChampion && (
        <span
          aria-label="Чемпион сервера"
          title="Чемпион сервера"
          style={{
            fontSize: '1.15em',
            lineHeight: 1,
            filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.9)) drop-shadow(0 0 12px rgba(255,215,0,0.55))',
          }}
        >
          👑
        </span>
      )}
      <span>{nickname || '—'}</span>
    </span>
  );
}

