import { lookup } from "node:dns";
import { get } from "node:https";
import { isIP } from "node:net";
import type { IncomingMessage } from "node:http";
import ipaddr from "ipaddr.js";

export const maxFeedBytes = 2 * 1024 * 1024;

function publicAddress(value: string) {
  const address = ipaddr.parse(value);
  return address.range() === "unicast" && (
    address.kind() === "ipv4" || address.match(ipaddr.parse("2000::"), 3)
  );
}

export function normalizeFeedUrl(value: string): string {
  const invalid = "Use a public HTTPS or webcal subscription link.";
  let url: URL;
  try {
    url = new URL(value.trim().replace(/^webcal:\/\//i, "https://"));
  } catch {
    throw new Error(invalid);
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    url.protocol !== "https:" || url.username || url.password || url.port ||
    (isIP(hostname) ? !publicAddress(hostname) :
      !hostname.includes(".") || /(^|\.)(localhost|local|internal)$/i.test(hostname))
  ) {
    throw new Error(invalid);
  }
  url.hash = "";
  return url.href;
}

// Check the actual addresses used by the TLS socket, including after redirects.
function requestFeed(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = get(url, {
      signal,
      agent: false,
      headers: { Accept: "text/calendar, */*;q=0.1" },
      lookup(hostname, options, callback) {
        lookup(hostname, { all: true, family: options.family }, (error, records) => {
          if (error || !records?.length || records.some((record) => !publicAddress(record.address))) {
            callback(new Error("This calendar host is unavailable."), "", 0);
          } else if (options.all) {
            callback(null, records);
          } else {
            callback(null, records[0].address, records[0].family);
          }
        });
      },
    }, resolve);
    req.once("error", reject);
  });
}

export async function downloadFeed(value: string) {
  let url = new URL(normalizeFeedUrl(value));
  const signal = AbortSignal.timeout(12_000);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await requestFeed(url, signal);
    const status = response.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
      response.destroy();
      url = new URL(normalizeFeedUrl(new URL(response.headers.location, url).href));
      continue;
    }
    if (status !== 200 || Number(response.headers["content-length"]) > maxFeedBytes) {
      response.destroy();
      throw new Error("The calendar feed could not be downloaded.");
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response) {
      size += chunk.length;
      if (size > maxFeedBytes) throw new Error("Calendar feed exceeds the size limit.");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("Too many calendar redirects.");
}
