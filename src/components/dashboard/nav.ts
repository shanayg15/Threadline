import {
  BarChart3,
  Box,
  MessageSquare,
  Settings,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** The six console sections, in fixed order. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/products", label: "Products", icon: Box },
  { href: "/settings", label: "Settings", icon: Settings },
];
