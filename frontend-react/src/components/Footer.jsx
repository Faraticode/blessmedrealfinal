const SOCIALS = [
  {
    label: "X",
    href: "https://x.com/useBlessMed",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Telegram",
    href: "https://t.me/useBlessMed",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M21.05 3.64 2.6 10.98c-1.24.5-1.23 1.19-.23 1.5l4.72 1.47 1.82 5.58c.22.6.37.84.8.84.4 0 .58-.18.8-.4l1.94-1.88 4.03 2.98c.74.4 1.28.2 1.47-.69l2.66-12.55c.28-1.15-.38-1.66-1.06-1.29z" />
      </svg>
    ),
  },
  { label: "Instagram", href: "#" },
  { label: "Discord", href: "#" },
  { label: "LinkedIn", href: "#" },
];

const LINK_COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Digital Health Records", href: "#" },
      { label: "Emergency QR Code", href: "#" },
      { label: "Health Tips Feed", href: "#" },
      { label: "Rewards", href: "#" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <span className="brand">
              Bless<span className="dot">Med</span>
            </span>
            <p className="muted">Your health. Your data. Your future.</p>

            <div className="footer-socials">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="footer-social-link"
                  aria-label={s.label}
                  title={s.label}
                  {...(s.href.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : { onClick: (e) => e.preventDefault() })}
                >
                  {s.icon || <span className="footer-social-fallback">{s.label[0]}</span>}
                </a>
              ))}
            </div>
          </div>

          <div className="footer-links">
            {LINK_COLUMNS.map((col) => (
              <div key={col.heading} className="footer-col">
                <h4>{col.heading}</h4>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} onClick={(e) => e.preventDefault()}>
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="footer-bottom">
          <p className="muted">© {year} BlessMed. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
