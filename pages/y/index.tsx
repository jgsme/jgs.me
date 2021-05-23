import { NextPage } from 'next'
import { Layout } from 'components/Layout'
import data from 'meta.json'
import updates from 'data/updates.json'

const TopPage: NextPage = () => (
  <Layout>
    <div id="page-1">
      <div className="profile">
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
        {data.mainLinks.map(link => (
          <a className="link" href={link.href} key={link.href}>
            <i className={`icon ${link.fa}`} />
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
          {data.links.map(link => (
            <a className="link" href={link.href} key={link.href}>
              <i className={`icon ${link.fa}`} />
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
          {updates.articles.map(article => (
            <a
              href={`https://amp.kbys.tk/${article.id}.html`}
              key={article.id}
              className="update-link link"
            >
              <div>{article.title}</div>
              <div>{new Date(article.updated * 1000).toLocaleDateString()}</div>
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
          {updates.clips.map(clip => (
            <a
              href={`https://amp.kbys.tk/${clip.id}.html`}
              key={clip.id}
              className="update-link link"
            >
              <div>{clip.title}</div>
              <div>{new Date(clip.updated * 1000).toLocaleDateString()}</div>
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
          <a
            href="https://amp.kbys.tk/5c29451d434bf90017d3b219.html"
            className="update-link link"
          >
            <div>About me (ja)</div>
          </a>
        </div>
      </div>
    </div>
  </Layout>
)

export default TopPage
