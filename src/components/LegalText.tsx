import { Banner, H2, P, Screen } from './ui';

export type Section = { title: string; text: string };

export default function LegalText({ sections, draft = true }: { sections: Section[]; draft?: boolean }) {
  return (
    <Screen>
      {draft && (
        <Banner tone="warning">
          ENTWURF – vor der Veröffentlichung von einem Anwalt prüfen lassen und die Platzhalter in [eckigen Klammern] ersetzen.
        </Banner>
      )}
      {sections.map((s) => (
        <P key={s.title}>
          <H2>{s.title}</H2>
          {'\n'}
          {s.text}
        </P>
      ))}
    </Screen>
  );
}
