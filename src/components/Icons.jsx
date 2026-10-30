// SVG icons (ported from the Comodophone web dashboard).
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export const PlayIcon = () => (
  <svg {...base}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
  </svg>
);
export const StopIcon = () => (
  <svg {...base}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </svg>
);
export const RestartIcon = () => (
  <svg {...base}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
  </svg>
);
export const ResetIcon = () => (
  <svg {...base}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 8v4l3 2" />
  </svg>
);
export const TrashIcon = () => (
  <svg {...base}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);
export const SearchIcon = () => (
  <svg {...base}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const PlusIcon = () => (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const PhoneIcon = () => (
  <svg {...base}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M10.5 18.5h3" />
  </svg>
);
export const ClockIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const BoltIcon = () => (
  <svg {...base}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </svg>
);
export const PowerIcon = () => (
  <svg {...base}>
    <path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0" />
  </svg>
);
export const LayersIcon = () => (
  <svg {...base}>
    <path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5" />
  </svg>
);
export const GiftIcon = () => (
  <svg {...base}>
    <rect x="3.5" y="8" width="17" height="4" rx="1" />
    <path d="M5 12v8h14v-8M12 8v12M12 8S10.5 4 8 4a2 2 0 0 0 0 4M12 8s1.5-4 4-4a2 2 0 0 1 0 4" />
  </svg>
);
export const TicketIcon = () => (
  <svg {...base}>
    <path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z" />
    <path d="M10 9v6" strokeDasharray="1.5 2" />
  </svg>
);
export const CardIcon = () => (
  <svg {...base}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M3 10h18M7 15h4" />
  </svg>
);
export const MessageIcon = () => (
  <svg {...base}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01" strokeWidth="2.6" />
  </svg>
);
export const ReceiptIcon = () => (
  <svg {...base}>
    <rect x="5" y="3" width="14" height="18" rx="3" />
    <path d="M9 9h6M9 13h6" />
  </svg>
);
export const PlanetIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="6" />
    <path d="M5.5 15.5C2.8 17.5 2 19 2.6 19.6c1.1 1.1 6.6-1.9 12.2-7.5S23 3.5 21.9 2.4c-.6-.6-2.1.2-4.1 2.9" />
  </svg>
);
export const HeadsetIcon = () => (
  <svg {...base}>
    <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
    <rect x="3" y="14" width="4" height="6" rx="1.5" />
    <rect x="17" y="14" width="4" height="6" rx="1.5" />
    <path d="M19 20c0 1-2 2-5 2" />
  </svg>
);
export const BookIcon = () => (
  <svg {...base}>
    <path d="M6 4h12v16H6z" />
    <path d="M9 4V2.5M15 4V2.5M9 10h6M9 14h4" />
  </svg>
);
export const LogoutIcon = () => (
  <svg {...base}>
    <path d="M14 4H6v16h8M10 12h11M17 8l4 4-4 4" />
  </svg>
);
export const ChevronRightIcon = () => (
  <svg {...base}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const ArrowLeftIcon = () => (
  <svg {...base}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const CpuIcon = () => (
  <svg {...base}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <rect x="10" y="10" width="4" height="4" fill="currentColor" />
    <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
  </svg>
);
export const RamIcon = () => (
  <svg {...base}>
    <rect x="3" y="6" width="18" height="10" rx="1.5" />
    <path d="M7 16v3M11 16v3M15 16v3M7 10h2M11 10h2M15 10h2" />
  </svg>
);
export const DiskIcon = () => (
  <svg {...base}>
    <path d="M5 3h11l3 3v15H5z" />
    <path d="M8 3v5h7V3M8 21v-6h8v6" />
  </svg>
);
export const AndroidIcon = () => (
  <svg {...base}>
    <path d="M6 11a6 6 0 0 1 12 0v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
    <path d="M8 5 6.8 3.2M16 5l1.2-1.8M9.5 8.5h.01M14.5 8.5h.01" />
  </svg>
);
export const DevicesIcon = () => (
  <svg {...base}>
    <rect x="3" y="4" width="13" height="16" rx="2" />
    <rect x="11" y="8" width="10" height="13" rx="2" fill="var(--surface)" />
  </svg>
);
export const GamepadIcon = () => (
  <svg {...base}>
    <path d="M6 8h12a4 4 0 0 1 3.9 4.9l-1 4.3a2.2 2.2 0 0 1-3.8.9L15 16H9l-2.1 2.1a2.2 2.2 0 0 1-3.8-.9l-1-4.3A4 4 0 0 1 6 8z" />
    <path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01" />
  </svg>
);
export const ChevronDownIcon = () => (
  <svg {...base}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const CheckIcon = () => (
  <svg {...base}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const GearIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const EditIcon = () => (
  <svg {...base}>
    <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
  </svg>
);
export const CopyIcon = () => (
  <svg {...base}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
  </svg>
);
export const CloseIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const CameraIcon = () => (
  <svg {...base}>
    <rect x="3" y="7" width="18" height="13" rx="3" />
    <circle cx="12" cy="13.5" r="3.5" />
    <path d="M9 7l1.5-3h3L15 7" />
  </svg>
);
export const UploadIcon = () => (
  <svg {...base}>
    <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
  </svg>
);
export const ShieldIcon = () => (
  <svg {...base}>
    <path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);
export const PointerIcon = () => (
  <svg {...base}>
    <path d="M9 11V5a1.5 1.5 0 0 1 3 0v5M12 10V8.5a1.5 1.5 0 0 1 3 0V11M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.8-2.4L4 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16V11" />
  </svg>
);
export const SwapIcon = () => (
  <svg {...base}>
    <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />
  </svg>
);
export const GemIcon = () => (
  <svg {...base}>
    <path d="M6 3h12l3 6-9 12L3 9zM3 9h18M9 3l3 18M15 3l-3 18" />
  </svg>
);
export const RootIcon = () => (
  <svg {...base}>
    <path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6z" />
    <path d="M10 16V8h2.5a2 2 0 0 1 0 4H10M12.5 12l2 4" />
  </svg>
);
export const ImageIcon = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 18 5-5 4 4 2-2 5 5" />
  </svg>
);
export const InstallIcon = () => (
  <svg {...base}>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path d="M12 7v7M9 11l3 3 3-3" />
  </svg>
);
export const FolderUpIcon = () => (
  <svg {...base}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M12 16v-5M9.5 13.5 12 11l2.5 2.5" />
  </svg>
);
export const TargetIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);
export const VolumeUpIcon = () => (
  <svg {...base}>
    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
    <path d="M16 12h5M18.5 9.5v5" />
  </svg>
);
export const VolumeDownIcon = () => (
  <svg {...base}>
    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
    <path d="M16 12h5" />
  </svg>
);
export const ClipboardIcon = () => (
  <svg {...base}>
    <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
    <path d="M9 4.5V3h6v1.5" />
  </svg>
);
export const RotateIcon = () => (
  <svg {...base}>
    <rect x="3" y="9" width="11" height="12" rx="2" />
    <path d="M10 3h4a6 6 0 0 1 6 6v2M17.5 8.5 20 11l2.5-2.5" />
  </svg>
);
export const WifiIcon = () => (
  <svg {...base}>
    <path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 15.8a4.8 4.8 0 0 1 6.4 0" />
    <circle cx="12" cy="19" r="1" fill="currentColor" />
  </svg>
);
