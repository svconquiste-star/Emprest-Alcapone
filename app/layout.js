import './globals.css';

import { Outfit, Merriweather } from 'next/font/google';
import Providers from './providers';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-serif',
  display: 'swap',
});

const PIXEL_ID = '1494594679053438';

export const metadata = {
  title: 'Fale com um Especialista | Atendimento via WhatsApp',
  description: 'Atendimento rápido e humano via WhatsApp.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${merriweather.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    var url = new URL(window.location.href);
    var fbclid = url.searchParams.get('fbclid');
    if (fbclid) {
      var fbc = 'fb.1.' + Date.now() + '.' + fbclid;
      var expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = '_fbc=' + fbc + '; path=/; expires=' + expires + '; SameSite=Lax';
    }
  } catch(e){}
})();
!function(f,b,e,v,n,t,s){
  if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)
}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('set','autoConfig',false,'${PIXEL_ID}');
fbq('init','${PIXEL_ID}');
fbq('track','PageView');
            `,
          }}
        />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
