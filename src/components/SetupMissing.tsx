import { Screen, H1, P, Banner } from './ui';

/** Wird angezeigt, wenn die Supabase-Zugangsdaten in `.env` fehlen. */
export default function SetupMissing() {
  return (
    <Screen edges={['top', 'bottom']}>
      <H1>Einrichtung fehlt</H1>
      <Banner tone="warning">
        Die App ist noch nicht mit einer Datenbank verbunden.
      </Banner>
      <P>1. Kopiere die Datei .env.example nach .env</P>
      <P>2. Trage die Supabase-URL und den anon-Key ein (Supabase → Project Settings → API).</P>
      <P>3. Starte die App neu (npx expo start).</P>
      <P muted>Details stehen in der README.md.</P>
    </Screen>
  );
}
