import React, { Fragment, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import {
  Menu,
  Moon,
  Sun,
  LogOut,
  User,
  Building2,
  Settings2,
  LayoutTemplate,
} from "lucide-react";
import { Menu as HeadlessMenu, Transition } from "@headlessui/react";
import { NotificationBell } from "../components/NotificationBell";
import { useTranslation } from "react-i18next";
import { DraggableWidgetSpace } from "../components/topbar/DraggableWidgetSpace";
import { useWidgetStore } from "../store/widgetStore";

interface TopBarProps {
  onMenuClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { uiMode, setUiMode, theme, toggleTheme } = useUserPreferences();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("common");
  const isRtl = useMemo(() => i18n.dir() === "rtl", [i18n]);
  const { widgets, toggleWidget, isLayoutMode, setLayoutMode } =
    useWidgetStore();
  const widgetTypeLabel = (type: string) =>
    t(`widgets.types.${type}`, { defaultValue: type });

  const userInitial = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <header
      className={clsx(
        "min-h-[48px] h-auto flex items-center justify-between pl-1 pr-4 sticky top-0 z-50 transition-all duration-300 print:hidden py-1",
        "bg-[rgba(var(--color-bg-primary-rgb),0.8)] backdrop-blur-md border-b border-[var(--color-border)] shadow-sm",
      )}
    >
      {/* Mobile Menu Button - takes 0 width on desktop */}
      <button
        onClick={onMenuClick}
        className="p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded lg:hidden shrink-0"
      >
        <Menu className="w-5 h-5" />
      </button>

      <DraggableWidgetSpace />

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-3 px-4">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] p-2 rounded-lg"
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </Button>

          {/* Layout Mode Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLayoutMode(!isLayoutMode)}
            className={clsx(
              "p-2 rounded-lg transition-all",
              isLayoutMode
                ? "bg-indigo-600 text-white shadow-lg scale-110"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]",
            )}
          >
            <Settings2
              className={clsx("w-4 h-4", isLayoutMode && "animate-spin-slow")}
            />
          </Button>

          {/* Widget Manager Moved to Dropdown or similar if needed, but for now we keep it focused */}
          <HeadlessMenu as="div" className="relative">
            <HeadlessMenu.Button className="p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] rounded-lg transition-colors">
              <LayoutTemplate className="w-4 h-4" />
            </HeadlessMenu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <HeadlessMenu.Items
                className={clsx(
                  "absolute z-50 mt-2 w-48 rounded-xl bg-[var(--color-bg-primary)] shadow-lg shadow-slate-900/10 border border-[var(--color-border)] focus:outline-none p-2 pointer-events-auto",
                  isRtl ? "left-0 origin-top-left" : "right-0 origin-top-right"
                )}
              >
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 mt-1">
                  {t("widgets.managerTitle", "Workspace Widgets")}
                </div>
                {widgets.map((w) => (
                  <HeadlessMenu.Item key={w.id}>
                    {({ active }) => (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toggleWidget(w.id);
                        }}
                        className={clsx(
                          "flex items-center justify-between w-full px-2 py-2 text-xs rounded-lg transition-colors font-bold tracking-tight uppercase",
                          active
                            ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                            : "text-[var(--color-text-secondary)]",
                        )}
                      >
                        <span>{widgetTypeLabel(w.type)}</span>
                        <div
                          className={clsx(
                            "w-2.5 h-2.5 rounded-full border shadow-inner",
                            w.visible
                              ? "bg-emerald-500 border-emerald-600"
                              : "bg-slate-100 border-slate-300",
                          )}
                        />
                      </button>
                    )}
                  </HeadlessMenu.Item>
                ))}
              </HeadlessMenu.Items>
            </Transition>
          </HeadlessMenu>

          {/* Notification Bell */}
          <NotificationBell />
        </div>

        <HeadlessMenu as="div" className="relative ml-2">
          <div>
            <HeadlessMenu.Button className="flex items-center rounded-full bg-[var(--color-bg-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 hover:ring-2 hover:ring-indigo-100 transition-all p-0.5 border border-transparent hover:border-indigo-100">
              <span className="sr-only">Open user menu</span>
              <div className="h-9 w-9 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm ring-1 ring-white">
                {userInitial}
              </div>
            </HeadlessMenu.Button>
          </div>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <HeadlessMenu.Items
              className={clsx(
                "absolute z-10 mt-3 w-56 rounded-xl bg-[var(--color-bg-primary)] shadow-lg shadow-slate-900/10 ring-1 ring-black/5 focus:outline-none overflow-hidden",
                isRtl ? "left-0 origin-top-left" : "right-0 origin-top-right",
              )}
            >
              <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
                <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                  {user?.displayName || "User"}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] font-medium truncate mt-0.5">
                  {user?.email}
                </p>
              </div>

              <div className="p-1">
                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => navigate("/profile")}
                      className={clsx(
                        "flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors mt-1",
                        active
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                      )}
                    >
                      <User className="w-4 h-4" />
                      Your Profile
                    </button>
                  )}
                </HeadlessMenu.Item>

                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => {
                        setUiMode("classic");
                        navigate("/company-selector");
                      }}
                      className={clsx(
                        "flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors mb-1 border-b border-[var(--color-border)] pb-3 rounded-b-none",
                        active
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                      )}
                    >
                      <Building2 className="w-4 h-4" />
                      Switch Company
                    </button>
                  )}
                </HeadlessMenu.Item>

                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button
                      onClick={logout}
                      className={clsx(
                        "flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors mt-1",
                        active
                          ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "text-red-600 dark:text-red-500 hover:bg-red-50 hover:text-red-700",
                      )}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  )}
                </HeadlessMenu.Item>
              </div>
            </HeadlessMenu.Items>
          </Transition>
        </HeadlessMenu>
      </div>
    </header>
  );
};
