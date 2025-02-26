'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from './providers';
import { Provider } from 'react-redux';
import { store } from '@/store/store';

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Provider store={store}>
          <Providers>
            {children}
          </Providers>
        </Provider>
      </body>
    </html>
  );
}