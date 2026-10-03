// Stroke icons drawn the same way as FX Fundamental Bias (24px grid, 2px round strokes).
type P = { className?: string };

const svg = (children: React.ReactNode) =>
  function Icon({ className }: P) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        {children}
      </svg>
    );
  };

export const SearchIcon = svg(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>);
export const ChevronDown = svg(<path d="M6 9l6 6 6-6" />);
export const RefreshIcon = svg(<><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 4v5h-5" /></>);
export const ExpandIcon = svg(<><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></>);
export const ResetIcon = svg(<><path d="M3 12a9 9 0 1 0 2.64-6.36" /><path d="M3 4v5h5" /></>);
export const CloseIcon = svg(<><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>);
export const CheckIcon = svg(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const CalendarIcon = svg(<><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17" /><path d="M8 3v4" /><path d="M16 3v4" /></>);
export const PlusIcon = svg(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
