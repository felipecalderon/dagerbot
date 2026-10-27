interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  lastUpdated: string;
  summary: string;
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  lastUpdated: "2026-10-27",
  summary:
    "This Privacy Policy explains how DagerBot collects, uses, and safeguards information when you interact with our Discord bot and associated HTTP services.",
  sections: [
    {
      title: "1. Information We Collect",
      paragraphs: [
        "Discord Identifiers: We may process your Discord User ID, Guild (Server) ID, and Channel ID to provide features such as channel guarding, meme ranking, server configuration, and conversational context.",
        "Message Content: Content of messages sent directly to DagerBot via Direct Messages (DMs), command invocations, or channel mentions is processed in real time to generate responses.",
        "Configuration and Statistics: Server-specific settings (e.g., allowed channels, meme modules) and aggregate usage counters (e.g., meme leaderboard statistics) are stored persistently in our database.",
      ],
    },
    {
      title: "2. How We Use Information",
      paragraphs: [
        "To deliver core bot functionality, including generating AI chat completions, handling server administration commands, and maintaining community leaderboard features.",
        "To enforce rate limits and prevent abuse of the service.",
        "We do NOT sell, rent, or trade your personal data with third-party data brokers or advertisers.",
      ],
    },
    {
      title: "3. Third-Party Services",
      paragraphs: [
        "Discord API: For receiving events, messages, and dispatching bot responses in compliance with Discord Developer Terms of Service.",
        "OpenAI API: Message prompts and recent conversation context are forwarded to OpenAI to generate AI chat completions in accordance with OpenAI's API privacy standards.",
        "MongoDB Database: Used for persisting server configuration data, ranking statistics, and temporary chat session state.",
      ],
    },
    {
      title: "4. Data Retention and Deletion",
      paragraphs: [
        "Chat history sessions are temporary and expire automatically based on configured TTL (Time-To-Live).",
        "Server configuration and ranking data remain stored as long as DagerBot is active in the respective guild.",
        "Users and server administrators can request complete deletion of their stored data at any time by contacting the bot developers.",
      ],
    },
    {
      title: "5. Contact & Inquiries",
      paragraphs: [
        "If you have questions regarding this Privacy Policy or wish to request data removal, please reach out via our official Discord community or project repository.",
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  title: "Terms of Service",
  lastUpdated: "2026-10-27",
  summary:
    "By adding, configuring, or interacting with DagerBot on Discord, you agree to be bound by these Terms of Service.",
  sections: [
    {
      title: "1. Acceptance of Terms",
      paragraphs: [
        "By accessing or using DagerBot, you acknowledge that you have read, understood, and agree to adhere to these Terms of Service as well as Discord's Terms of Service and Community Guidelines.",
        "If you do not agree to these terms, please remove the bot from your Discord server and discontinue use.",
      ],
    },
    {
      title: "2. Acceptable Use",
      paragraphs: [
        "You agree not to use DagerBot to generate, distribute, or facilitate harmful, illegal, abusive, harassing, or hateful content.",
        "You agree not to attempt to reverse engineer, bypass rate limits, spam, exploit security vulnerabilities, or overload the bot infrastructure.",
        "Server administrators are responsible for managing bot permissions and ensuring proper usage within their respective communities.",
      ],
    },
    {
      title: "3. AI Output Disclaimer",
      paragraphs: [
        "DagerBot uses large language models (OpenAI) to generate conversational responses. Outputs may occasionally be inaccurate, satirical, fictional, or incomplete.",
        "AI responses do not constitute professional, legal, medical, or financial advice. The developers assume no responsibility for actions taken based on bot outputs.",
      ],
    },
    {
      title: "4. Availability & Termination",
      paragraphs: [
        "DagerBot is provided on an 'as is' and 'as available' basis without warranties of any kind.",
        "We reserve the right to modify, suspend, or terminate access to the bot for any user, channel, or server at our discretion, particularly in cases of abuse or policy violations.",
      ],
    },
    {
      title: "5. Limitation of Liability",
      paragraphs: [
        "To the maximum extent permitted by applicable law, DagerBot developers and maintainers shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.",
      ],
    },
    {
      title: "6. Changes to Terms",
      paragraphs: [
        "We may update these Terms of Service periodically. Continued use of DagerBot after any modifications constitutes acceptance of the updated terms.",
      ],
    },
  ],
};

function renderLegalHtml(doc: LegalDocument, currentPath: "/privacy" | "/terms"): string {
  const isPrivacy = currentPath === "/privacy";
  const sectionsHtml = doc.sections
    .map(
      (section) => `
      <section class="legal-section">
        <h2>${escapeHtml(section.title)}</h2>
        ${section.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")}
      </section>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(doc.title)} - DagerBot</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --primary-hover: #7dd3fc;
      --border: #334155;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem 1rem;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .container {
      width: 100%;
      max-width: 800px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2.5rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    }
    header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    .badge {
      display: inline-block;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    h1 {
      font-size: 2.25rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #fff;
    }
    .meta {
      font-size: 0.9rem;
      color: var(--text-muted);
    }
    nav {
      margin-top: 1rem;
      display: flex;
      gap: 1rem;
    }
    nav a {
      color: var(--text-muted);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.95rem;
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      transition: background-color 0.2s, color 0.2s;
    }
    nav a:hover {
      color: var(--text);
      background-color: rgba(255, 255, 255, 0.05);
    }
    nav a.active {
      color: var(--primary);
      background-color: rgba(56, 189, 248, 0.1);
    }
    .summary-box {
      background: rgba(56, 189, 248, 0.06);
      border-left: 4px solid var(--primary);
      padding: 1rem 1.25rem;
      border-radius: 0 8px 8px 0;
      margin-bottom: 2rem;
      font-size: 1.05rem;
      color: #e2e8f0;
    }
    .legal-section {
      margin-bottom: 2rem;
    }
    .legal-section h2 {
      font-size: 1.35rem;
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 0.75rem;
    }
    .legal-section p {
      color: #cbd5e1;
      margin-bottom: 0.75rem;
    }
    footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <main class="container">
    <header>
      <span class="badge">DagerBot Documentation</span>
      <h1>${escapeHtml(doc.title)}</h1>
      <p class="meta">Last updated: ${escapeHtml(doc.lastUpdated)}</p>
      <nav>
        <a href="/privacy" class="${isPrivacy ? "active" : ""}">Privacy Policy</a>
        <a href="/terms" class="${!isPrivacy ? "active" : ""}">Terms of Service</a>
      </nav>
    </header>

    <div class="summary-box">
      ${escapeHtml(doc.summary)}
    </div>

    ${sectionsHtml}

    <footer>
      <p>&copy; ${new Date().getFullYear()} DagerBot. All rights reserved.</p>
    </footer>
  </main>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderPrivacyPolicyHtml(): string {
  return renderLegalHtml(PRIVACY_POLICY, "/privacy");
}

export function renderTermsOfServiceHtml(): string {
  return renderLegalHtml(TERMS_OF_SERVICE, "/terms");
}
