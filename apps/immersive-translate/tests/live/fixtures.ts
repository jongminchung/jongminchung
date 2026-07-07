import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { type BrowserContext, test as base, chromium, expect } from "@playwright/test";

interface LocalSite {
  readonly origin: string;
  readonly close: () => Promise<void>;
}

interface ExtensionFixtures {
  readonly context: BrowserContext;
  readonly extensionId: string;
  readonly localSite: LocalSite;
}

function extensionPath(): string {
  return path.resolve(process.cwd(), process.env.EXTENSION_PATH ?? ".output/chrome-mv3");
}

function envFlag(name: string): boolean {
  return process.env[name] === "1" || process.env[name]?.toLowerCase() === "true";
}

async function createLocalSite(): Promise<LocalSite> {
  const server = createServer((request, response) => {
    const pathname = request.url ?? "/";
    if (pathname.startsWith("/captions.vtt")) {
      response.writeHead(200, { "Content-Type": "text/vtt; charset=utf-8" });
      response.end(`WEBVTT

00:00.000 --> 00:02.000
Hello from captions

00:01.000 --> 00:03.000
Overlap source cue
`);
      return;
    }

    if (pathname.startsWith("/captions-ko.vtt")) {
      response.writeHead(200, { "Content-Type": "text/vtt; charset=utf-8" });
      response.end(`WEBVTT

00:00.000 --> 00:02.000
안녕하세요 자막

00:01.000 --> 00:03.000
겹치는 원문 자막
`);
      return;
    }

    if (pathname.startsWith("/udemy-captions.vtt")) {
      response.writeHead(200, { "Content-Type": "text/vtt; charset=utf-8" });
      response.end(`WEBVTT

00:00.000 --> 00:02.000
<v Instructor>Udemy VTT opening</v>

00:02.000 --> 00:04.000
Udemy VTT second line
`);
      return;
    }

    if (pathname.startsWith("/youtube-caption-json3")) {
      const videoId = new URL(`http://127.0.0.1${pathname}`).searchParams.get("v") ?? "alpha";
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          events:
            videoId === "beta"
              ? [
                  {
                    tStartMs: 0,
                    dDurationMs: 2000,
                    segs: [{ utf8: "Beta opening caption" }],
                  },
                ]
              : videoId === "batch"
                ? [
                    {
                      tStartMs: 0,
                      dDurationMs: 2000,
                      segs: [{ utf8: "YouTube hello" }, { utf8: "\ncaption" }],
                    },
                    {
                      tStartMs: 2000,
                      dDurationMs: 2000,
                      segs: [{ utf8: "Second YouTube cue" }],
                    },
                    {
                      tStartMs: 4000,
                      dDurationMs: 2000,
                      segs: [{ utf8: "Third YouTube cue" }],
                    },
                    {
                      tStartMs: 6000,
                      dDurationMs: 2000,
                      segs: [{ utf8: "Fourth YouTube cue" }],
                    },
                    {
                      tStartMs: 8000,
                      dDurationMs: 2000,
                      segs: [{ utf8: "Fifth YouTube cue" }],
                    },
                    {
                      tStartMs: 10000,
                      dDurationMs: 2000,
                      segs: [{ utf8: "Sixth YouTube cue" }],
                    },
                  ]
                : [
                  {
                    tStartMs: 0,
                    dDurationMs: 2000,
                    segs: [{ utf8: "YouTube hello" }, { utf8: "\ncaption" }],
                  },
                  {
                    tStartMs: 2000,
                    dDurationMs: 2000,
                    segs: [{ utf8: "Second YouTube cue" }],
                  },
                ],
        }),
      );
      return;
    }

    if (pathname.startsWith("/youtube-caption-empty")) {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end("");
      return;
    }

    if (pathname.startsWith("/youtube-caption-format")) {
      const url = new URL(`http://127.0.0.1${pathname}`);
      const format = url.searchParams.get("fmt") ?? "json3";
      if (format === "json3") {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end("");
        return;
      }
      if (format === "srv3") {
        response.writeHead(200, { "Content-Type": "text/xml; charset=utf-8" });
        response.end(
          '<timedtext><body><p t="0" d="2000"><s>SRV3 opening caption</s></p><p t="2000" d="2000"><s>SRV3 second cue</s></p></body></timedtext>',
        );
        return;
      }
      response.writeHead(200, { "Content-Type": "text/vtt; charset=utf-8" });
      response.end(`WEBVTT

00:00.000 --> 00:02.000
VTT opening caption
`);
      return;
    }

    if (pathname.startsWith("/api/timedtext")) {
      const url = new URL(`http://127.0.0.1${pathname}`);
      if (!url.searchParams.get("pot")) {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end("");
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          events: [
            {
              tStartMs: 0,
              dDurationMs: 2000,
              segs: [{ utf8: "Player captured first caption" }],
            },
            {
              tStartMs: 2000,
              dDurationMs: 2000,
              segs: [{ utf8: "Player captured second caption" }],
            },
          ],
        }),
      );
      return;
    }

    if (pathname.includes("youtube-no-captions")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>YouTube No Caption Fixture</title></head><body>
                <main><h1>YouTube No Caption Fixture</h1><div id="movie_player"></div><video controls muted width="640"></video></main>
                <script>
                    window.ytInitialPlayerResponse = { videoDetails: { videoId: 'no-captions' } };
                    document.querySelector('#movie_player').getPlayerResponse = () => window.ytInitialPlayerResponse;
                </script>
            </body></html>`);
      return;
    }

    if (pathname.includes("youtube-player-fetch-capture")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>YouTube Player Capture Fixture</title></head><body>
                <main>
                    <h1>YouTube Player Capture Fixture</h1>
                    <div id="movie_player"></div>
                    <video id="youtube-video" controls muted width="640"></video>
                    <button class="ytp-subtitles-button" type="button" aria-pressed="false">CC</button>
                    <div class="ytp-caption-window-container" style="display:block; visibility: visible"></div>
                </main>
                <script>
                    const origin = window.location.origin;
                    const button = document.querySelector('.ytp-subtitles-button');
                    window.__fixturePlayerTimedTextRequests = 0;
                    button.addEventListener('click', async () => {
                        button.setAttribute('aria-pressed', 'true');
                        window.__fixturePlayerTimedTextRequests += 1;
                        await fetch(origin + '/api/timedtext?v=player-capture&lang=en&fmt=json3&potc=1&pot=fixture-token&xorb=2&xobt=3&xovt=3&c=WEB');
                    });
                    window.ytInitialPlayerResponse = {
                        videoDetails: { videoId: 'player-capture' },
                        captions: {
                            playerCaptionsTracklistRenderer: {
                                captionTracks: [{
                                    baseUrl: origin + '/api/timedtext?v=player-capture&lang=en&fmt=json3',
                                    name: { simpleText: 'English' },
                                    languageCode: 'en',
                                    vssId: '.player-capture-en'
                                }]
                            }
                        }
                    };
                    document.querySelector('#movie_player').getPlayerResponse = () => window.ytInitialPlayerResponse;
                </script>
            </body></html>`);
      return;
    }

    if (pathname.includes("youtube-cc-fallback")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>YouTube CC Fallback Fixture</title></head><body>
                <main>
                    <h1>YouTube CC Fallback Fixture</h1>
                    <div id="movie_player"></div>
                    <video id="youtube-video" controls muted width="640"></video>
                    <button class="ytp-subtitles-button" type="button" aria-pressed="false">CC</button>
                    <div class="ytp-caption-window-container" style="display:none">
                        <span class="ytp-caption-segment"></span>
                    </div>
                </main>
                <script>
                    const origin = window.location.origin;
                    const video = document.querySelector('#youtube-video');
                    const button = document.querySelector('.ytp-subtitles-button');
                    const container = document.querySelector('.ytp-caption-window-container');
                    const segment = document.querySelector('.ytp-caption-segment');
                    function captionText() {
                        return video.currentTime >= 2 ? 'Fallback second caption' : 'Fallback first caption';
                    }
                    function renderCaption() {
                        if (button.getAttribute('aria-pressed') !== 'true') return;
                        container.style.display = 'block';
                        segment.textContent = captionText();
                    }
                    button.addEventListener('click', () => {
                        button.setAttribute('aria-pressed', 'true');
                        renderCaption();
                    });
                    video.addEventListener('timeupdate', renderCaption);
                    window.ytInitialPlayerResponse = {
                        videoDetails: { videoId: 'cc-fallback' },
                        captions: {
                            playerCaptionsTracklistRenderer: {
                                captionTracks: [{
                                    baseUrl: origin + '/youtube-caption-empty?v=cc-fallback&lang=en&fmt=srv3',
                                    name: { simpleText: 'English' },
                                    languageCode: 'en',
                                    vssId: '.cc-fallback-en'
                                }]
                            }
                        }
                    };
                    document.querySelector('#movie_player').getPlayerResponse = () => window.ytInitialPlayerResponse;
                </script>
            </body></html>`);
      return;
    }

    if (pathname.includes("youtube-cc-delayed")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>YouTube Delayed CC Fixture</title></head><body>
                <main>
                    <h1>YouTube Delayed CC Fixture</h1>
                    <div id="movie_player"></div>
                    <video id="youtube-video" controls muted width="640"></video>
                    <button class="ytp-subtitles-button" type="button" aria-pressed="false">CC</button>
                    <div class="ytp-caption-window-container" style="display:none; visibility: visible">
                        <span class="ytp-caption-segment"></span>
                    </div>
                </main>
                <script>
                    const origin = window.location.origin;
                    const video = document.querySelector('#youtube-video');
                    const button = document.querySelector('.ytp-subtitles-button');
                    const container = document.querySelector('.ytp-caption-window-container');
                    const segment = document.querySelector('.ytp-caption-segment');
                    function captionText() {
                        return video.currentTime >= 2 ? 'Delayed second caption' : 'Delayed first caption';
                    }
                    function renderCaption() {
                        if (button.getAttribute('aria-pressed') !== 'true') return;
                        container.style.display = 'block';
                        segment.textContent = captionText();
                    }
                    button.addEventListener('click', () => {
                        button.setAttribute('aria-pressed', 'true');
                        window.setTimeout(renderCaption, 3000);
                    });
                    video.addEventListener('timeupdate', renderCaption);
                    window.ytInitialPlayerResponse = {
                        videoDetails: { videoId: 'cc-delayed' },
                        captions: {
                            playerCaptionsTracklistRenderer: {
                                captionTracks: [{
                                    baseUrl: origin + '/youtube-caption-empty?v=cc-delayed&lang=en&fmt=srv3',
                                    name: { simpleText: 'English' },
                                    languageCode: 'en',
                                    vssId: '.cc-delayed-en'
                                }]
                            }
                        }
                    };
                    document.querySelector('#movie_player').getPlayerResponse = () => window.ytInitialPlayerResponse;
                </script>
            </body></html>`);
      return;
    }

    if (pathname.includes("youtube-transcript-fallback")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>YouTube Transcript Fixture</title><style>
                ytd-transcript-segment-renderer { display: block; padding: 4px 0; }
            </style></head><body>
                <main>
                    <h1>YouTube Transcript Fixture</h1>
                    <div id="movie_player"></div>
                    <video id="youtube-video" controls muted width="640"></video>
                    <button class="ytp-subtitles-button" type="button" aria-pressed="false" aria-label="Subtitles/closed captions unavailable">CC</button>
                    <section id="description">
                        <tp-yt-paper-button id="expand" type="button">...more</tp-yt-paper-button>
                        <div id="transcript-section" style="display:none">
                            <button id="show-transcript" type="button" aria-label="Show transcript">Show transcript</button>
                        </div>
                    </section>
                    <aside id="transcript-panel" hidden>
                        <ytd-transcript-segment-renderer>
                            <span id="timestamp">0:00</span>
                            <yt-formatted-string id="cue">Transcript first caption</yt-formatted-string>
                        </ytd-transcript-segment-renderer>
                        <ytd-transcript-segment-renderer>
                            <span id="timestamp">0:02</span>
                            <yt-formatted-string id="cue">Transcript second caption</yt-formatted-string>
                        </ytd-transcript-segment-renderer>
                    </aside>
                </main>
                <script>
                    const origin = window.location.origin;
                    document.querySelector('#expand').addEventListener('click', () => {
                        document.querySelector('#transcript-section').style.display = 'block';
                    });
                    document.querySelector('#show-transcript').addEventListener('click', () => {
                        document.querySelector('#transcript-panel').hidden = false;
                    });
                    window.ytInitialPlayerResponse = {
                        videoDetails: { videoId: 'transcript-fallback' },
                        captions: {
                            playerCaptionsTracklistRenderer: {
                                captionTracks: [{
                                    baseUrl: origin + '/youtube-caption-empty?v=transcript-fallback&lang=en&fmt=srv3',
                                    name: { simpleText: 'English' },
                                    languageCode: 'en',
                                    vssId: '.transcript-fallback-en'
                                }]
                            }
                        }
                    };
                    document.querySelector('#movie_player').getPlayerResponse = () => window.ytInitialPlayerResponse;
                </script>
            </body></html>`);
      return;
    }

    if (pathname.includes("youtube-srv3-fallback")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>YouTube SRV3 Fallback Fixture</title></head><body>
                <main>
                    <h1>YouTube SRV3 Fallback Fixture</h1>
                    <div id="movie_player"></div>
                    <video id="youtube-video" controls muted width="640"></video>
                </main>
                <script>
                    const origin = window.location.origin;
                    window.ytInitialPlayerResponse = {
                        videoDetails: { videoId: 'srv3-fallback' },
                        captions: {
                            playerCaptionsTracklistRenderer: {
                                captionTracks: [{
                                    baseUrl: origin + '/youtube-caption-format?v=srv3-fallback&lang=en&fmt=srv3',
                                    name: { simpleText: 'English' },
                                    languageCode: 'en',
                                    vssId: '.srv3-fallback-en'
                                }]
                            }
                        }
                    };
                    document.querySelector('#movie_player').getPlayerResponse = () => window.ytInitialPlayerResponse;
                </script>
            </body></html>`);
      return;
    }

    if (pathname.includes("youtube-watch")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>YouTube Caption Fixture</title></head><body>
                <main>
                    <h1>YouTube Caption Fixture</h1>
                    <div id="movie_player"></div>
                    <video id="youtube-video" controls muted width="640"></video>
                    <button id="navigate-beta" type="button">Navigate beta video</button>
                </main>
                <script>
                    const origin = window.location.origin;
                    function playerResponse(videoId) {
                        return {
                            videoDetails: { videoId },
                            captions: {
                                playerCaptionsTracklistRenderer: {
                                    captionTracks: [{
                                        baseUrl: origin + '/youtube-caption-json3?v=' + videoId + '&lang=en&fmt=srv3',
                                        name: { simpleText: videoId === 'beta' ? 'English Beta' : 'English' },
                                        languageCode: 'en',
                                        vssId: '.' + videoId + '-en'
                                    }]
                                }
                            }
                        };
                    }
                    const initialVideoId = new URL(window.location.href).searchParams.get('v') || 'alpha';
                    window.ytInitialPlayerResponse = playerResponse(initialVideoId);
                    document.querySelector('#movie_player').getPlayerResponse = () => window.ytInitialPlayerResponse;
                    document.querySelector('#navigate-beta').addEventListener('click', () => {
                        window.ytInitialPlayerResponse = playerResponse('beta');
                        window.dispatchEvent(new Event('yt-navigate-finish'));
                        window.dispatchEvent(new Event('yt-player-updated'));
                    });
                </script>
            </body></html>`);
      return;
    }

    if (pathname.includes("udemy-vtt")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>Udemy VTT Fixture</title></head><body>
                <main>
                    <h1>Udemy VTT Fixture</h1>
                    <video id="udemy-video" controls muted preload="metadata" width="640"></video>
                    <a href="/udemy-captions.vtt" data-vtt="/udemy-captions.vtt" aria-label="English Udemy subtitles">Caption artifact</a>
                </main>
            </body></html>`);
      return;
    }

    if (pathname.includes("udemy-transcript")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>Udemy Transcript Fixture</title></head><body>
                <main>
                    <h1>Udemy Transcript Fixture</h1>
                    <video id="udemy-transcript-video" controls muted preload="metadata" width="640"></video>
                    <section aria-label="Lecture transcript">
                        <p data-start="0" data-end="2">Udemy transcript opening</p>
                        <p data-start="2" data-end="4">Udemy transcript follow up</p>
                    </section>
                </main>
            </body></html>`);
      return;
    }

    if (pathname.includes("udemy-no-captions")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>Udemy No Caption Fixture</title></head><body>
                <main><h1>Udemy No Caption Fixture</h1><video controls muted width="640"></video></main>
            </body></html>`);
      return;
    }

    if (pathname.includes("udemy-spa")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>Udemy SPA Fixture</title></head><body>
                <main>
                    <h1>Udemy SPA Fixture</h1>
                    <video id="udemy-spa-video" controls muted preload="metadata" width="640"></video>
                    <button id="navigate-lecture" type="button">Navigate lecture</button>
                    <section id="transcript" aria-label="Lecture transcript">
                        <p data-start="0" data-end="2">Udemy SPA first lecture</p>
                    </section>
                </main>
                <script>
                    document.querySelector('#navigate-lecture').addEventListener('click', () => {
                        history.pushState({}, '', '/udemy-spa?lecture=beta');
                        document.querySelector('#transcript').innerHTML = '<p data-start="0" data-end="2">Udemy SPA second lecture</p>';
                    });
                </script>
            </body></html>`);
      return;
    }

    if (pathname.includes("go-docs")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>Go Documentation Fixture</title></head><body>
                <header>
                    <nav aria-label="Primary navigation">
                        <a href="/why-go">Why Go</a>
                        <a href="/learn">Learn</a>
                        <a href="/docs">Docs</a>
                    </nav>
                </header>
                <main>
                    <h1>Documentation</h1>
                    <p>The Go programming language is an open source project to make programmers more productive.</p>
                    <p>Go is expressive, concise, clean, and efficient.</p>
                    <section>
                        <h2>Getting Started</h2>
                        <p>Instructions for downloading and installing Go.</p>
                        <p>A brief Hello, World tutorial to get started.</p>
                    </section>
                </main>
            </body></html>`);
      return;
    }

    if (pathname.includes("article-empty")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>Control Heavy Article</title></head><body>
                <main>
                    <button type="button">Save control text</button>
                    <a href="/alpha">Navigation link only</a>
                    <pre>Do not translate preformatted code</pre>
                    <code>const skipped = true;</code>
                    <p hidden>Hidden paragraph should not translate</p>
                    <input value="Input text should stay untouched">
                </main>
            </body></html>`);
      return;
    }

    if (pathname.includes("article-long")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>Slow Translation Article</title></head><body>
                <article>
                    <h1>Slow translation article</h1>
                    <p>First slow paragraph for cancellation testing.</p>
                    <p>Second slow paragraph for cancellation testing.</p>
                    <p>Third slow paragraph for cancellation testing.</p>
                </article>
            </body></html>`);
      return;
    }

    if (pathname.includes("article-next")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>Navigation Article Fixture</title></head><body>
                <main>
                    <h1>Navigation Article Fixture</h1>
                    <p>Second page opening for navigation translation.</p>
                    <p>Follow-up paragraph after page navigation.</p>
                </main>
            </body></html>`);
      return;
    }

    if (pathname.includes("article-third")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>Third Article Fixture</title></head><body>
                <main>
                    <h1>Third Article Fixture</h1>
                    <p>Third page should translate after automatic navigation.</p>
                    <p>Automatic navigation keeps the bilingual view current.</p>
                </main>
            </body></html>`);
      return;
    }

    if (pathname.includes("article") && !pathname.includes("korean-article")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>Readable Article Fixture</title></head><body>
                <main>
                    <h1>Readable Article Fixture</h1>
                    <p>Opening paragraph for webpage translation.</p>
                    <p><span><button type="button">Deep nested control should stay private</button></span></p>
                    <p>Repeated paragraph for duplicate lookup.</p>
                    <p>Repeated paragraph for duplicate lookup.</p>
                    <ul>
                        <li>First list item to translate.</li>
                        <li><button type="button">Nested list control should stay original</button></li>
                    </ul>
                    <blockquote>Quoted insight for translation.</blockquote>
                    <p style="display:none">Hidden paragraph should not translate.</p>
                    <pre>Preformatted code should not translate.</pre>
                    <p><a href="/alpha">Control-like link text should stay original</a></p>
                    <button type="button" id="article-control">Article control remains usable</button>
                </main>
                <script>
                    document.querySelector('#article-control').addEventListener('click', () => {
                        document.body.dataset.controlClicked = 'true';
                    });
                </script>
            </body></html>`);
      return;
    }

    if (pathname.includes("korean-article")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html lang="ko"><head><title>한국어 기사 Fixture</title></head><body>
                <main>
                    <h1>한국어 기사 Fixture</h1>
                    <p>첫 번째 문단은 한국어 웹페이지 번역을 검증합니다.</p>
                    <p>두 번째 문단도 영어로 바뀌어야 합니다.</p>
                </main>
            </body></html>`);
      return;
    }

    if (pathname.includes("captions") && !pathname.includes("captions-ko")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>Caption Fixture</title></head><body>
                <main>
                    <h1>Caption Fixture</h1>
                    <video id="caption-video" controls muted preload="metadata" width="640">
                        <track default kind="subtitles" src="/captions.vtt" srclang="en" label="English captions">
                    </video>
                </main>
            </body></html>`);
      return;
    }

    if (pathname.includes("captions-ko")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html lang="ko"><head><title>Korean Caption Fixture</title></head><body>
                <main>
                    <h1>Korean Caption Fixture</h1>
                    <video id="caption-video" controls muted preload="metadata" width="640">
                        <track default kind="subtitles" src="/captions-ko.vtt" srclang="ko" label="Korean captions">
                    </video>
                </main>
            </body></html>`);
      return;
    }

    if (pathname.includes("no-caption")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>No Caption Fixture</title></head><body>
                <main><h1>No Caption Fixture</h1><video controls muted width="640"></video></main>
            </body></html>`);
      return;
    }

    const title = pathname.includes("beta") ? "Beta Planning" : "Alpha Research";
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      `<!doctype html><html><head><title>${title}</title></head><body>${title}</body></html>`,
    );
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start local test server.");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({ browserName: _browserName }, use, testInfo) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), `tab-shelf-${testInfo.workerIndex}-`));
    const context = await chromium.launchPersistentContext(userDataDir, {
      ignoreDefaultArgs: ["--disable-extensions"],
      ...(process.env.PW_EXECUTABLE_PATH
        ? { executablePath: process.env.PW_EXECUTABLE_PATH }
        : { channel: process.env.PW_CHANNEL ?? "chromium" }),
      headless: process.env.PW_HEADED !== "1",
      ignoreHTTPSErrors: envFlag("PW_IGNORE_HTTPS_ERRORS"),
      args: [
        `--disable-extensions-except=${extensionPath()}`,
        `--load-extension=${extensionPath()}`,
        ...(envFlag("PW_IGNORE_CERTIFICATE_ERRORS")
          ? ["--ignore-certificate-errors", "--allow-insecure-localhost"]
          : []),
      ],
    });

    await use(context);
    await context.close();
    await rm(userDataDir, { force: true, recursive: true });
  },
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker");
    }

    const extensionId = serviceWorker.url().split("/")[2];
    await use(extensionId);
  },
  localSite: async ({ browserName: _browserName }, use) => {
    const site = await createLocalSite();
    await use(site);
    await site.close();
  },
});

export { expect };

async function writeFixture(fileName: string, contents: string): Promise<string> {
  const filePath = path.join(await mkdtemp(path.join(tmpdir(), "tab-shelf-fixture-")), fileName);
  await writeFile(filePath, contents);
  return filePath;
}

export async function writeValidShareBundleFixture(): Promise<string> {
  return writeFixture(
    "collection-bundle.json",
    JSON.stringify({
      kind: "tab-shelf.collection-bundle",
      version: 1,
      exportedAt: Date.now(),
      name: "Shared Bundle",
      description: "Imported from Playwright",
      color: "#f6bd60",
      cards: [
        {
          title: "Imported Alpha",
          url: "https://example.com/imported-alpha",
          faviconUrl: "",
          note: "Bundle note",
        },
      ],
    }),
  );
}

export async function writeBrokenJsonFixture(): Promise<string> {
  return writeFixture("broken-share-bundle.json", "{not valid json");
}

export async function writeWorkspaceJsonFixture(): Promise<string> {
  return writeFixture(
    "workspace-not-share-bundle.json",
    JSON.stringify({
      version: 1,
      updatedAt: Date.now(),
      activeSpaceId: "space-fixture",
      spaces: [
        {
          id: "space-fixture",
          name: "Workspace Fixture",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sortOrder: 0,
        },
      ],
      collections: [],
      settings: {},
    }),
  );
}
