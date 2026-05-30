import * as Lucide from 'lucide-react';
import {
  PiHouseDuotone,
  PiHandCoinsDuotone,
  PiShoppingCartDuotone,
  PiClipboardTextDuotone,
  PiPackageDuotone,
  PiUsersDuotone,
  PiUsersThreeDuotone,
  PiMonitorDuotone,
  PiFactoryDuotone,
  PiBriefcaseDuotone,
  PiWrenchDuotone,
  PiRobotDuotone,
  PiGearDuotone,
  PiBuildingsDuotone,
  PiShieldDuotone,
  PiShieldCheckDuotone,
  PiChartBarDuotone,
  PiChartPieDuotone,
  PiSquaresFourDuotone,
  PiBookDuotone,
  PiBookOpenDuotone,
  PiBookmarkDuotone,
  PiBookmarksDuotone,
  PiFileTextDuotone,
  PiFileMagnifyingGlassDuotone,
  PiFolderOpenDuotone,
  PiFilesDuotone,
  PiCodeDuotone,
  PiTruckDuotone,
  PiReceiptDuotone,
  PiArrowUUpLeftDuotone,
  PiArrowsLeftRightDuotone,
  PiArrowsClockwiseDuotone,
  PiStackDuotone,
  PiStackPlusDuotone,
  PiSlidersHorizontalDuotone,
  PiWarningDuotone,
  PiCurrencyCircleDollarDuotone,
  PiCoinsDuotone,
  PiCoinDuotone,
  PiTagDuotone,
  PiRulerDuotone,
  PiUserCheckDuotone,
  PiPercentDuotone,
  PiClockDuotone,
  PiScalesDuotone,
  PiPiggyBankDuotone,
  PiBankDuotone,
  PiTargetDuotone,
  PiWavesDuotone,
  PiCalculatorDuotone,
  PiPulseDuotone,
  PiPenNibDuotone,
  PiChatCircleDuotone,
  PiStorefrontDuotone,
  PiWarehouseDuotone,
  PiCheckSquareDuotone,
  PiFolderDuotone,
} from 'react-icons/pi';

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>;

// Single Phosphor Duotone icon set across the whole sidebar — module headers
// and sub-items both. Keys are the Lucide icon names declared in
// moduleMenuMap.ts so existing config doesn't change. Duotone reads as
// "alive but not loud" — two-tone monochrome via currentColor, scales from
// small list rows to large collapsed-sidebar tiles without losing balance.
//
// Fallback to Lucide if a name isn't mapped (rare; keeps the sidebar from
// breaking when moduleMenuMap.ts gains a new icon name we haven't covered).
const DUOTONE_ICONS: Record<string, IconComponent> = {
  // Shell / overview
  Home: PiHouseDuotone,
  LayoutDashboard: PiSquaresFourDuotone,
  LayoutGrid: PiSquaresFourDuotone,

  // Modules
  HandCoins: PiHandCoinsDuotone,           // Accounting
  ShoppingCart: PiShoppingCartDuotone,     // Sales
  ClipboardList: PiClipboardTextDuotone,   // Purchases
  Package: PiPackageDuotone,               // Inventory
  Users: PiUsersDuotone,                   // HR
  Users2: PiUsersThreeDuotone,             // Groups
  UsersRound: PiUsersThreeDuotone,         // CRM
  Monitor: PiMonitorDuotone,               // POS
  Factory: PiFactoryDuotone,               // Manufacturing
  Briefcase: PiBriefcaseDuotone,           // Projects
  Wrench: PiWrenchDuotone,                 // Tools
  Bot: PiRobotDuotone,                     // AI Assistant
  Settings: PiGearDuotone,                 // Settings
  Building2: PiBuildingsDuotone,           // Companies
  Shield: PiShieldDuotone,                 // Permissions
  ShieldCheck: PiShieldCheckDuotone,       // Approval Center

  // Reports family
  BarChart3: PiChartBarDuotone,
  PieChart: PiChartPieDuotone,

  // Documents / files
  FileText: PiFileTextDuotone,
  FileSearch: PiFileMagnifyingGlassDuotone,
  FolderOpen: PiFolderOpenDuotone,
  Folder: PiFolderDuotone,
  CheckSquare: PiCheckSquareDuotone,

  // Accounting reports + tools
  Book: PiBookDuotone,
  BookOpen: PiBookOpenDuotone,
  BookMinus: PiBookmarkDuotone,
  BookMarked: PiBookmarksDuotone,
  ScrollText: PiFileTextDuotone,
  Waves: PiWavesDuotone,
  Clock3: PiClockDuotone,
  Landmark: PiBankDuotone,
  Target: PiTargetDuotone,
  Scale: PiScalesDuotone,
  Layout: PiSquaresFourDuotone,
  PiggyBank: PiPiggyBankDuotone,
  Tags: PiTagDuotone,
  Calculator: PiCalculatorDuotone,

  // Sales / Purchases / Inventory operational
  Truck: PiTruckDuotone,
  Receipt: PiReceiptDuotone,
  Undo2: PiArrowUUpLeftDuotone,
  Store: PiStorefrontDuotone,
  Warehouse: PiWarehouseDuotone,
  PackagePlus: PiStackPlusDuotone,
  SlidersHorizontal: PiSlidersHorizontalDuotone,
  ArrowLeftRight: PiArrowsLeftRightDuotone,
  Layers: PiStackDuotone,
  Repeat: PiArrowsClockwiseDuotone,
  AlertTriangle: PiWarningDuotone,
  CircleDollarSign: PiCurrencyCircleDollarDuotone,
  Coins: PiCoinsDuotone,
  Tag: PiTagDuotone,
  Ruler: PiRulerDuotone,
  UserCheck: PiUserCheckDuotone,
  Percent: PiPercentDuotone,

  // AI / dev
  MessageSquare: PiChatCircleDuotone,
  FileSignature: PiPenNibDuotone,
  Activity: PiPulseDuotone,
  Code: PiCodeDuotone,
  Brain: PiPulseDuotone,
  Table: PiFilesDuotone,
  Bookmark: PiBookmarkDuotone,
  Coin: PiCoinDuotone,
};

export const resolveSidebarIcon = (name?: string | null): IconComponent | null => {
  if (!name) return null;
  return DUOTONE_ICONS[name] ?? (Lucide as any)[name] ?? null;
};
