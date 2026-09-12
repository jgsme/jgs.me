import { USER_AGENT } from "../config";
import type { ContainerParams } from "./record";

export const GRAPH_BASE = "https://graph.threads.net/v1.0";
// リフレッシュだけホストの直下にあり、投稿系と違って /v1.0 を含まない。
export const REFRESH_URL = "https://graph.threads.net/refresh_access_token";

function postForm(
  url: string,
  params: Record<string, string>,
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams(params).toString(),
  });
}

export function requestContainer(
  token: string,
  userID: string,
  params: ContainerParams,
): Promise<Response> {
  return postForm(`${GRAPH_BASE}/${userID}/threads`, {
    media_type: "TEXT",
    text: params.text,
    link_attachment: params.linkAttachment,
    access_token: token,
  });
}

export function requestPublish(
  token: string,
  userID: string,
  creationID: string,
): Promise<Response> {
  return postForm(`${GRAPH_BASE}/${userID}/threads_publish`, {
    creation_id: creationID,
    access_token: token,
  });
}

// permalink は media id から導出できないので取りに行く。
export function requestPermalink(
  token: string,
  mediaID: string,
): Promise<Response> {
  const q = new URLSearchParams({ fields: "permalink", access_token: token });
  return fetch(`${GRAPH_BASE}/${mediaID}?${q}`, {
    headers: { "User-Agent": USER_AGENT },
  });
}

export function requestRefresh(token: string): Promise<Response> {
  const q = new URLSearchParams({
    grant_type: "th_refresh_token",
    access_token: token,
  });
  return fetch(`${REFRESH_URL}?${q}`, {
    headers: { "User-Agent": USER_AGENT },
  });
}
