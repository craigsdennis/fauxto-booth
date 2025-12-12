import type { HTMLAttributes } from "react";

const topLinks = [
  { href: "https://agents.cloudflare.com", label: "Cloudflare Agents SDK" },
  { href: "https://replicate.com", label: "Replicate" },
];

const codeLink = {
  href: "https://github.com/craigsdennis/fauxto-booth",
  label: "the code",
};

export function FooterBadge({ className = "" }: HTMLAttributes<HTMLDivElement>) {
  return (
    <footer className={`rounded-3xl border border-white/10 bg-slate-900/80 px-4 py-3 text-center text-xs text-slate-300 backdrop-blur-sm ${className}`}>
      <p className="flex flex-wrap items-center justify-center gap-2">
        <span>Built with 🧡 using</span>
        {topLinks.map((link, index) => (
          <span key={link.href} className="space-x-2">
            <a
              href={link.href}
              className="text-cyan-300 hover:text-cyan-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </a>
            {index < topLinks.length - 1 && <span className="text-slate-500">🤝</span>}
          </span>
        ))}
      </p>
      <p className="mt-1 flex items-center justify-center gap-2">
        <span role="img" aria-label="Eyes">
          👀
        </span>
        <a
          href={codeLink.href}
          className="text-cyan-300 hover:text-cyan-200"
          target="_blank"
          rel="noopener noreferrer"
        >
          {codeLink.label}
        </a>
      </p>
    </footer>
  );
}
