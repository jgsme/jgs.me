import { icons } from "feather-icons";
import { Cutive_Mono } from "@next/font/google";
import data from "../../data/meta.json";
import updates from "../../data/updates.json";

const cutive = Cutive_Mono({
  weight: "400",
  subsets: ["latin"],
});

const titlePurify = (str: string) =>
  encodeURIComponent(str.replace(/\s/g, "_"));

const Page = async () => {
  return (
    <>
      <div id="page-1">
        <div className={`profile ${cutive.className}`}>
          <div className="photo">
            <img src="/static/takaya-kobayashi.jpg" />
          </div>
          <h1>{data.name}</h1>
          <h2>a.k.a.&nbsp;{data.aka}</h2>
        </div>
        <div className="copy">
          <p>{data.copy}</p>
        </div>
        <div className="main-links">
          {data.mainLinks.map((link) => (
            <a className="link" href={link.href} key={link.href}>
              <i
                className="icon"
                style={{ position: "relative", top: 4 }}
                dangerouslySetInnerHTML={{
                  // @ts-ignore
                  __html: icons[link.fa]?.toSvg({
                    width: 28,
                    height: 28,
                  }),
                }}
              ></i>
              {link.name}
            </a>
          ))}
        </div>
      </div>
      <div id="page-2">
        <div className="links">
          <h3>
            <span>Links</span>
          </h3>
          <div className="link-grid">
            {data.links.map((link) => (
              <a className="link" href={link.href} key={link.href}>
                <i
                  className="icon"
                  style={{ position: "relative", top: 2 }}
                  dangerouslySetInnerHTML={{
                    // @ts-ignore
                    __html: icons[link.fa]?.toSvg({ width: 24, height: 24 }),
                  }}
                ></i>
                <span>{link.name}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div id="page-3">
        <div className="links">
          <h3>
            <span>Recent Articles</span>
          </h3>
          <div className="update-container">
            {updates.articles.map((article) => (
              <a
                href={`https://w.kbys.tk/pages/${titlePurify(article.title)}`}
                key={article.id}
                className="update-link link"
              >
                <div>{article.title}</div>
                <div>{new Date(article.created).toLocaleDateString()}</div>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div id="page-4">
        <div className="links">
          <h3>
            <span>Recent Clips</span>
          </h3>
          <div className="update-container">
            {updates.clips.map((clip) => (
              <a
                href={`https://w.kbys.tk/pages/${titlePurify(clip.title)}`}
                key={clip.id}
                className="update-link link"
              >
                <div>{clip.title}</div>
                <div>{new Date(clip.created).toLocaleDateString()}</div>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div id="page-5">
        <div className="links">
          <h3>
            <span>More Info</span>
          </h3>
          <div className="update-container">
            <a href="https://w.kbys.tk/pages/jgs" className="update-link link">
              <div>About me (ja)</div>
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Page;
