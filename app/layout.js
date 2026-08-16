import './globals.css';

export const metadata = {
  title: 'VidFlow - Next-Gen YouTube Downloader',
  description: 'Download YouTube videos seamlessly in any resolution.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
