import '../index.css';
import Providers from './Providers';

export const metadata = {
  title: 'MT — Move Tracker',
  description: 'Track your workouts, meditations, and daily presence.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MT',
  },
  themeColor: '#030712',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
