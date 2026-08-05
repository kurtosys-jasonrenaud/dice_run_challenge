import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import kurtosysLogo from "../../logo-w.svg?url";
import { CHALLENGE_LABEL } from "../lib/challenge";
import { Card } from "./ui/primitives";

const CONTROLS: Array<{ title: string; body: string; status: "Met" | "Adapted" | "N/A" }> = [
  {
    title: "Token & secrets management",
    status: "Met",
    body: "Strava client secrets stay in Cloudflare Worker secrets. The browser never receives Strava access or refresh tokens. Only an opaque app session id is used by the frontend.",
  },
  {
    title: "OAuth 2.1 with PKCE",
    status: "Met",
    body: "Strava connect uses the authorization-code flow with PKCE (S256), a single-use state value, and a short-lived one-time exchange code. Session ids are not placed in redirect URLs.",
  },
  {
    title: "Session controls",
    status: "Met",
    body: "Sessions expire after 60 minutes idle or 12 hours absolute lifetime, matching Kurtosys standard session limits. Logout deletes the server-side session.",
  },
  {
    title: "API authentication",
    status: "Met",
    body: "Authenticated routes require a valid session. Public read endpoints (targets, runs, leaderboard) are intentionally approved for the shared office board. Target writes require a Strava session, the office publish token, or (until that token is configured) a browser request from the allowlisted origin with rate limiting.",
  },
  {
    title: "Transport & input validation",
    status: "Met",
    body: "All traffic is HTTPS via GitHub Pages and Cloudflare Workers. API inputs are allowlisted and size-capped. Rate limiting protects OAuth, run upload, and target publish endpoints.",
  },
  {
    title: "Frontend hardening",
    status: "Met",
    body: "React escapes output by default. There is no dangerouslySetInnerHTML. Fonts are self-hosted. Security headers and a Content Security Policy are applied on the static site and API responses.",
  },
  {
    title: "CORS allowlisting",
    status: "Met",
    body: "The API only reflects approved origins for the challenge site and local development. Unknown origins are rejected.",
  },
  {
    title: "Data exposure & error handling",
    status: "Met",
    body: "Strava upstream error bodies are not returned to browsers. OAuth redirects use generic error codes. Athlete tokens never appear in API JSON responses.",
  },
  {
    title: "HttpOnly cookie sessions",
    status: "Adapted",
    body: "GitHub Pages and the Worker API are different sites, so third-party cookies are unreliable. The app uses an opaque session bearer instead, never the Strava token itself. This exception is documented for the static hosting architecture.",
  },
  {
    title: "DPoP / FIDO2 / passkeys",
    status: "N/A",
    body: "This is an internal office fitness challenge with Strava as the identity provider. DPoP and passkeys are not applicable to the Strava OAuth integration surface.",
  },
  {
    title: "AI / regulated investment controls",
    status: "N/A",
    body: "The app does not process investor data, NAV, portfolio risk, or AI decision support. Sections 7 and 11 of the Kurtosys guide do not apply.",
  },
  {
    title: "Supply chain & CI controls",
    status: "Adapted",
    body: "Dependencies are locked with package-lock.json, Dependabot is enabled, and Pages deploys use GitHub OIDC. Full SLSA provenance and artefact signing remain roadmap items for this lightweight internal app.",
  },
];

const DATA_CLASSES = [
  {
    label: "High",
    items: "Strava client secret, Strava access/refresh tokens (Worker/KV only)",
  },
  {
    label: "Medium",
    items: "Opaque app session id (browser local storage), athlete profile used for leaderboard",
  },
  {
    label: "Low / public",
    items: "Published challenge targets, uploaded run distances, leaderboard standings",
  },
];

export function SecurityPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-4">
            <img src={kurtosysLogo} alt="Kurtosys" className="h-5 w-auto sm:h-6" />
            <span className="hidden h-6 w-px bg-white/30 sm:block" />
            <span className="flex items-center gap-2 text-sm font-bold tracking-tight sm:text-base">
              <span className="grid size-8 place-items-center rounded-full bg-signal text-ink">
                <ShieldCheck className="size-5" />
              </span>
              Security
            </span>
          </a>
          <a
            href="#top"
            className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-signal"
          >
            <ArrowLeft className="size-4" />
            Back to challenge
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
        <section className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-white sm:px-10">
          <div className="absolute -right-16 -top-20 size-56 rounded-full bg-signal/20 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="eyebrow text-signal">Kurtosys Secure Delivery · v4 aligned</p>
            <h1 className="mt-4 font-display text-4xl font-black tracking-tight sm:text-5xl">
              How Roll &amp; Run stays secure
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">
              This internal {CHALLENGE_LABEL} office challenge is built against the Kurtosys
              Secure Delivery &amp; Engineering Standards Guide v4.0. It is not a regulated
              investment system, so financial AI and NAV controls do not apply. The controls
              below cover secrets, OAuth, API hardening, and data exposure for this app.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
              <LockKeyhole className="size-3.5 text-signal" />
              Reviewed against Kurtosys standards · August 2026
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {DATA_CLASSES.map((item) => (
            <Card key={item.label} className="lift-card p-5">
              <p className="eyebrow">{item.label}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.items}</p>
            </Card>
          ))}
        </section>

        <section>
          <div className="mb-5">
            <p className="eyebrow">Control mapping</p>
            <h2 className="section-title">Standards coverage</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Status labels: Met means implemented for this architecture. Adapted means the
              control intent is met with a documented hosting exception. N/A means outside the
              scope of this office challenge.
            </p>
          </div>
          <div className="space-y-3">
            {CONTROLS.map((control) => (
              <Card key={control.title} className="lift-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="font-display text-xl font-bold">{control.title}</h3>
                  <span
                    className={
                      control.status === "Met"
                        ? "rounded-full bg-signal/25 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink"
                        : control.status === "Adapted"
                          ? "rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-primary"
                          : "rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
                    }
                  >
                    {control.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{control.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="lift-card p-5 sm:p-6">
            <p className="eyebrow">Trusted boundaries</p>
            <h3 className="mt-2 font-display text-2xl font-black">Architecture</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <li>Static frontend on GitHub Pages (no server secrets in the browser build except the intentional office publish capability token).</li>
              <li>Cloudflare Worker API holds Strava credentials and session state in KV.</li>
              <li>Strava is the only external identity and activity source.</li>
              <li>Challenge targets and leaderboard data are intentionally shared across the office.</li>
            </ul>
          </Card>
          <Card className="lift-card p-5 sm:p-6">
            <p className="eyebrow">Report a concern</p>
            <h3 className="mt-2 font-display text-2xl font-black">Vulnerability disclosure</h3>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Internal findings should go to the Kurtosys Security Team through the normal
              disclosure channel. External reports can use{" "}
              <a className="font-semibold text-primary underline-offset-2 hover:underline" href="mailto:security@kurtosys.com">
                security@kurtosys.com
              </a>
              , as described in the Secure Delivery guide.
            </p>
          </Card>
        </section>
      </main>

      <footer className="mt-16 bg-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <img src={kurtosysLogo} alt="Kurtosys" className="h-5 w-auto" />
            <span className="h-5 w-px bg-white/25" />
            <p className="font-bold text-white">Roll &amp; Run · Security</p>
          </div>
          <a className="font-semibold text-signal hover:underline" href="#top">
            Back to challenge
          </a>
        </div>
      </footer>
    </div>
  );
}
