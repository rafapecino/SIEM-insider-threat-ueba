import {
  ShieldHalf,
  ShieldCheck,
  LayoutDashboard,
  Siren,
  LineChart,
  ScrollText,
  LogOut,
  User,
  ScanSearch,
  AlertTriangle,
  FileText,
  Usb,
  Mail,
  KeyRound,
  Sparkles,
  Search,
  Download,
  Check,
  X,
  Clock,
  ChevronRight,
  Building2,
  Activity,
  Pencil,
  RefreshCw,
  UserCog,
  CircleCheck,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  shield: ShieldHalf,
  "shield-check": ShieldCheck,
  dashboard: LayoutDashboard,
  alerts: Siren,
  analytics: LineChart,
  audit: ScrollText,
  logout: LogOut,
  user: User,
  detector: ScanSearch,
  risk: AlertTriangle,
  file: FileText,
  usb: Usb,
  mail: Mail,
  logon: KeyRound,
  ai: Sparkles,
  search: Search,
  download: Download,
  check: Check,
  x: X,
  clock: Clock,
  chevron: ChevronRight,
  org: Building2,
  activity: Activity,
  note: Pencil,
  status: RefreshCw,
  assign: UserCog,
  ack: CircleCheck,
};

export function Icon({
  name,
  size = 16,
  className,
  strokeWidth = 2,
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  const Cmp = MAP[name] ?? AlertTriangle;
  return (
    <Cmp
      size={size}
      className={className}
      strokeWidth={strokeWidth}
      style={style}
    />
  );
}
