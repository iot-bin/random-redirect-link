import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import Script from 'next/script';
import '@/app/globals.css';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { LOCALE_COOKIE, normalizeLocale } from '@/lib/i18n/config';
import { messages } from '@/lib/i18n/messages';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const themeInitializationScript =
  'try{var theme=localStorage.getItem("theme");var dark=theme==="dark"||(theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=dark?"dark":"light"}catch{}';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return {
    title: process.env.SITE_TITLE || messages[locale]['metadata.title'],
    description: process.env.SITE_DESCRIPTION || messages[locale]['metadata.description'],
    icons: {
      icon: [
        { url: '/favicon.ico?v=2', type: 'image/x-icon' },
        { url: '/favicon-16x16.png?v=2', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png?v=2', sizes: '32x32', type: 'image/png' },
      ],
      shortcut: [{ url: '/favicon.ico?v=2', type: 'image/x-icon' }],
      apple: [
        { url: '/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' },
      ],
    },
    manifest: '/site.webmanifest',
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html lang={locale} data-theme="light" suppressHydrationWarning>
      <head>
        <Script id="theme-initialization" strategy="beforeInteractive">
          {themeInitializationScript}
        </Script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
