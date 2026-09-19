import React from "react";
import { Card, CardContent } from "../../components/ui/card";
import { EFFECTIVE_DATE, LEGAL_DOCS } from "../../legal/content";

export function LegalPage({ id, go }: { id: "privacy" | "terms"; go: (page: string) => void }) {
  const doc = LEGAL_DOCS[id];
  const other = id === "privacy" ? LEGAL_DOCS.terms : LEGAL_DOCS.privacy;
  const version = chrome.runtime.getManifest().version;

  return (
    <Card>
      <CardContent className="max-w-3xl space-y-8 p-8">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Effective {EFFECTIVE_DATE} · Version {version}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">{doc.intro}</p>
        </div>

        {doc.sections.map((s, i) => (
          <section key={s.heading} className="space-y-3">
            <h2 className="text-base font-semibold">
              <span className="mr-2 text-muted-foreground">{i + 1}.</span>
              {s.heading}
            </h2>
            {s.paragraphs?.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul className="space-y-2">
                {s.bullets.map((b) => (
                  <li key={b} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className="border-t pt-6 text-sm text-muted-foreground">
          Also see the{" "}
          <button onClick={() => go(other.id)} className="text-primary hover:underline">
            {other.title}
          </button>
          .
        </p>
      </CardContent>
    </Card>
  );
}
