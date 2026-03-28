const SIZE = { width: '1em', height: '1em', viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor' };
const FILL = { width: '1em', height: '1em', viewBox: '0 0 16 16', fill: 'currentColor' };

export function SearchIcon() {
  return (
    <svg {...SIZE} stroke-width="1.5">
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
    </svg>
  );
}

export function EmptySetIcon() {
  return (
    <svg {...SIZE} stroke-width="1.5">
      <circle cx="8" cy="8" r="5.5" />
      <line x1="4" y1="12" x2="12" y2="4" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg {...SIZE} stroke-width="1.5" stroke-linecap="round">
      <path d="M13 8A5 5 0 1 1 8 3" />
      <polyline points="13 3 13 7 9 7" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg {...FILL} viewBox="0 0 10 10">
      <path d="M2 3.5L5 7L8 3.5" />
    </svg>
  );
}

export function SpinnerIcon() {
  return (
    <svg {...SIZE} stroke-width="1.5" stroke-linecap="round" class="variable-picker-spinner">
      <path d="M8 3a5 5 0 1 0 5 5" />
    </svg>
  );
}

export function LightningIcon() {
  return (
    <svg {...FILL} viewBox="0 0 10 16">
      <path d="M6 0L1 9h4l-1 7 5-9H5l1-7z" />
    </svg>
  );
}
