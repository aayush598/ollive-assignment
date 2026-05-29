"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { UserButton, useUser } from "@clerk/nextjs";

function ChatIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();

  const navItems = [
    { href: "/chat", label: "Chat", icon: ChatIcon },
    { href: "/conversations", label: "Conversations", icon: ListIcon },
    { href: "/admin", label: "Admin", icon: GridIcon },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="nav-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/chat" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-lg flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-105">
                  <span className="text-white font-bold text-sm tracking-tight">A</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-base text-slate-900">AI Ops</span>
                  <span className="font-semibold text-base text-indigo-600">TaskFlow</span>
                </div>
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "text-indigo-700 bg-indigo-50/80"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <Icon />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center ring-1 ring-indigo-200">
                    <span className="text-xs font-semibold text-indigo-700">
                      {user.firstName?.charAt(0) ??
                        user.emailAddresses[0]?.emailAddress?.charAt(0)?.toUpperCase() ??
                        "U"}
                    </span>
                  </div>
                  <span className="text-sm text-slate-600 font-medium">
                    {user.fullName ?? user.firstName}
                  </span>
                </div>
              )}
              <UserButton
                appearance={{
                  elements: {
                    avatarBox:
                      "w-8 h-8 rounded-full ring-2 ring-indigo-100 ring-offset-2 ring-offset-white",
                  },
                }}
              />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-gradient-to-b from-slate-50 to-white">{children}</main>
    </div>
  );
}
