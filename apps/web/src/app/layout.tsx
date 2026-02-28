import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ALI Remote — Remote Device Control',
  description: 'Control and automate Android devices from anywhere',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
