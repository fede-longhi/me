import type { CertificationItem, EducationItem } from "@/lib/types";

type CredentialsProps = {
  education: EducationItem[];
  certifications: CertificationItem[];
  educationTitle: string;
  certificationsTitle: string;
};

export function Credentials({
  education,
  certifications,
  educationTitle,
  certificationsTitle,
}: CredentialsProps) {
  return (
    <div className="mt-12 grid gap-10 border-t border-line pt-10 lg:grid-cols-2">
      <div>
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
          {educationTitle}
        </h3>
        <ul className="mt-4 space-y-4">
          {education.map((item) => (
            <li key={`${item.school}-${item.degree ?? ""}`}>
              {item.degree ? (
                <p className="font-semibold text-ink">{item.degree}</p>
              ) : null}
              <p
                className={
                  item.degree
                    ? "mt-1 text-sm text-blue"
                    : "font-semibold text-ink"
                }
              >
                {item.school}
              </p>
              <p className="mt-1 text-sm text-ink-muted">{item.period}</p>
              {item.note ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {item.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
          {certificationsTitle}
        </h3>
        <ul className="mt-4 space-y-3">
          {certifications.map((cert) => (
            <li
              key={cert.name}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line/70 pb-3 last:border-b-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-semibold text-ink">{cert.name}</p>
                <p className="text-xs text-ink-muted">{cert.issuer}</p>
              </div>
              <time className="text-xs font-medium text-green">{cert.date}</time>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
