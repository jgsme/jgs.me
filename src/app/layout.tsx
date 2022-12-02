import "./index.css";
import Script from "next/script";
import Logo from "../../public/static/mark.svg";

const RootLayout: React.FC<React.PropsWithChildren> = ({ children }) => (
  <html>
    <Script src="https://www.googletagmanager.com/gtag/js?id=G-79P1DC858F"></Script>
    <Script
      dangerouslySetInnerHTML={{
        __html: `window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-79P1DC858F');`,
      }}
      id="ga"
    ></Script>
    <body>
      <header>
        <a href="/y">
          <Logo />
        </a>
      </header>
      <div>{children}</div>
    </body>
  </html>
);

export default RootLayout;
