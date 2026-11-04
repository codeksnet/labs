import type { Metadata } from "next";
import { PostHogProvider } from "@codeksnet/shared";
import "./globals.css";

export const metadata: Metadata = { title: "Tenant isolation · Codeks Labs" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="mx-auto max-w-3xl p-6 text-neutral-900">
        <PostHogProvider demo="tenants">{children}</PostHogProvider>
        <footer className="mt-16 border-t pt-4 text-sm text-neutral-500">
          Maintained by <a className="underline" href="https://github.com/FortanPireva">Fortan Pireva</a> at{" "}
          <a className="underline" href="https://codeks.net">Codeks</a> ·{" "}
          <a className="underline" href="https://labs.codeks.net">All demos</a>
        </footer>
      </body>
    </html>
  );
}
