import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth, signOut } from "@/lib/auth";
import NavHeader from "@/components/layout/NavHeader";
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
          <NavHeader
            userEmail={session.user.email ?? ""}
            signOutAction={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          />
        )}
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
