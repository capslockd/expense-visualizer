import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense Visualizer",
  description: "Upload statements, categorize every expense, see where the money goes.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
        {session?.user && (
          <header className="border-b border-zinc-200 bg-white">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
              <nav className="flex items-center gap-6">
                <Link href="/dashboard" className="text-sm font-semibold">
                  Expense Visualizer
                </Link>
                <Link
                  href="/dashboard"
                  className="text-sm text-zinc-600 hover:text-zinc-900"
                >
                  Dashboard
                </Link>
                <Link
                  href="/upload"
                  className="text-sm text-zinc-600 hover:text-zinc-900"
                >
                  Upload
                </Link>
              </nav>
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-zinc-500 sm:inline">
                  {session.user.email}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </header>
        )}
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
