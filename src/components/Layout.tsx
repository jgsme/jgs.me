import { FC } from "react";
import Head from "next/head";
import Logo from "../../public/static/mark.svg";

const ga = `(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
  ga('create', 'UA-96527600-1', 'auto');
  ga('send', 'pageview');`;

export const Layout: FC = ({ children }) => (
  <div>
    <style jsx global>{`
      html,
      body {
        margin: 0;
        padding: 0;
      }

      header {
        position: relative;
        height: 4rem;
        margin-bottom: 2rem;
        display: flex;
        flex-direction: row;
        justify-content: center;
        font-family: monospace;
        padding: 0.3rem 0;
        background-color: #82221c;
      }

      header a {
        width: 100%;
        height: 100%;
      }

      header svg {
        fill: #efefef;
        width: 100%;
        height: 100%;
        position: absolute;
      }

      header a::before {
        content: " ";
        border-top: 7rem solid #bd3129;
        border-left: 7rem solid transparent;
        border-right: 7rem solid transparent;
        border-bottom: 0 solid transparent;
        position: absolute;
        top: 0;
        left: 50%;
        margin-left: -7rem;
      }

      #page-1 {
        height: calc(100vh - 10rem);
      }

      .profile {
        text-align: center;
        font-family: "Cutive Mono", monospace;
      }

      .profile .photo img {
        width: 15rem;
        height: 15rem;
        border-radius: 15rem;
      }

      .profile h1,
      .profile h2 {
        margin: 0;
      }

      .copy {
        text-align: center;
        font-family: serif;
      }

      .main-links {
        display: flex;
        flex-direction: row;
        justify-content: center;
        font-size: 2rem;
        font-family: monospace;
      }

      .link {
        color: #333;
        text-decoration: none;
        display: block;
        margin: 0 1rem;
      }

      .link:hover {
        color: #333;
        text-decoration: underline;
      }

      .link:active {
        color: #bd3129;
      }

      .link:visited {
        color: #333;
      }

      .link .icon {
        font-size: 1.6rem;
        margin-right: 0.5rem;
      }

      #page-2 {
        height: calc(100vh - 20rem);
      }

      #page-3,
      #page-4,
      #page-5 {
        margin-bottom: 20rem;
      }

      .links h3 {
        text-align: center;
        font-weight: normal;
        width: 80vw;
        margin: 0 auto;
        border-bottom: 1px solid #666;
        line-height: 0;
      }

      .links h3 span {
        background-color: #fff;
        padding: 0 2rem;
      }

      .link-grid {
        display: grid;
        grid-template-columns: auto auto;
        grid-gap: 1rem 2rem;
        margin: 1.5rem auto;
        justify-content: center;
      }

      .link-grid a {
        margin: 0;
      }

      .link-grid a span {
        position: relative;
        top: -0.2rem;
      }

      .update-container {
        margin: 1.5rem auto;
      }

      .update-link {
        width: 50vw;
        margin: 0 auto;
        margin-bottom: 1rem;
      }

      @media (max-width: 376px) {
        .update-link {
          width: 90vw;
          margin: 0 auto;
          margin-bottom: 1rem;
        }
      }

      .update-link div:nth-of-type(1) {
        font-size: 1.5rem;
      }

      ._404 {
        text-align: center;
        font-size: 3rem;
      }
    `}</style>
    <Head>
      <title>Takaya Kobayashi</title>
      <link
        rel="shortcut icon"
        type="image/x-icon"
        href="/static/favicon.ico"
      />
      <meta name="author" content="Takaya Kobayashi" />
      <meta name="description" content="About Takaya Kobayashi" />
      <meta name="theme-color" content="#BD3129" />
      <meta property="og:title" content="Takaya Kobayashi" />
      <meta property="og:url" content="https://kbys.tk/y" />
      <meta
        property="og:image"
        content="https://kbys.tk/static/takaya-kobayashi.jpg"
      />
      <meta property="og:image:width" content="400" />
      <meta property="og:image:height" content="400" />
      <meta property="og:description" content="About Takaya Kobayashi" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:site" content="@neo6120" />
      <meta name="twitter:creator" content="@neo6120" />
      <meta name="msapplication-TileColor" content="#bd3129" />
      <link
        href="https://fonts.googleapis.com/css?family=Cutive+Mono"
        rel="stylesheet"
      />
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/static/apple-touch-icon.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href="/static/favicon-32x32.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="16x16"
        href="/static/favicon-16x16.png"
      />
      <link rel="manifest" href="/static/site.webmanifest" />
      <link
        rel="mask-icon"
        href="/static/safari-pinned-tab.svg"
        color="#bd3129"
      />
      <script
        type="text/javascript"
        dangerouslySetInnerHTML={{ __html: ga }}
      ></script>
    </Head>
    <div>
      <header>
        <a href="/y">
          <Logo />
        </a>
      </header>
      {children}
    </div>
  </div>
);
