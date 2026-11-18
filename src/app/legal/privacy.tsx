import LegalText from '@/components/LegalText';

export default function Privacy() {
  return (
    <LegalText
      sections={[
        { title: '1. Verantwortlicher', text: '[Name des Betreibers], [Anschrift], E-Mail: [datenschutz@deine-domain.de]' },
        {
          title: '2. Welche Daten wir verarbeiten',
          text:
            'Konto: E-Mail-Adresse und Passwort (verschlüsselt). Profil: Vor- und Nachname, Geburtsdatum, Postleitzahl, Stadt, ' +
            'bei Auftraggebern und Eltern optional die Telefonnummer. Inhalte: Angebote, Aufträge, Auftragsadressen, Chatnachrichten, ' +
            'Bewertungen, Meldungen und Blockierungen.',
        },
        {
          title: '3. Wer was sehen kann',
          text:
            'Öffentlich (nur für angemeldete Nutzer) sind bei Schülern nur Vorname, erster Buchstabe des Nachnamens, Alter, ' +
            'PLZ/Stadt, Beschreibung, Angebote und Bewertungen. Voller Name, Geburtsdatum und Telefonnummer sehen nur du selbst, ' +
            'deine verknüpften Eltern und das Moderationsteam. Die Auftragsadresse sieht der Schüler erst nach seiner Zusage. ' +
            'Eltern können Aufträge und Chats ihres Kindes einsehen.',
        },
        {
          title: '4. Zweck und Rechtsgrundlage',
          text:
            'Vermittlung von Hilfsaufträgen (Art. 6 Abs. 1 lit. b DSGVO), Schutz Minderjähriger und Missbrauchsvermeidung ' +
            '(Art. 6 Abs. 1 lit. f DSGVO). Bei Nutzern unter 16 Jahren ist die Einwilligung der Eltern erforderlich (Art. 8 DSGVO); ' +
            'sie wird in der App eingeholt.',
        },
        {
          title: '5. Auftragsverarbeiter',
          text:
            'Wir nutzen Supabase (Datenbank und Login) mit Serverstandort [EU – Frankfurt]. Mit dem Anbieter besteht ein ' +
            'Auftragsverarbeitungsvertrag. Es findet kein Tracking und keine Werbung statt.',
        },
        {
          title: '6. Speicherdauer und Löschung',
          text:
            'Du kannst dein Konto jederzeit in der App unter „Konto → Konto löschen“ endgültig löschen. Dabei werden alle ' +
            'zugehörigen Daten entfernt. Meldungen können zur Missbrauchsabwehr bis zu [6 Monate] aufbewahrt werden.',
        },
        {
          title: '7. Deine Rechte',
          text:
            'Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Widerruf einer Einwilligung. ' +
            'Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren.',
        },
      ]}
    />
  );
}
