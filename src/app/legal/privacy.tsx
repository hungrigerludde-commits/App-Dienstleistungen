import LegalText from '@/components/LegalText';

export default function Privacy() {
  return (
    <LegalText
      de={[
        { title: '1. Verantwortlicher', text: '[Name des Betreibers], [Anschrift], E-Mail: [datenschutz@deine-domain.de]' },
        { title: '2. Welche Daten wir verarbeiten', text: 'Konto (E-Mail, Passwort verschlüsselt), Profil (Name, Geburtsdatum, PLZ, Stadt, Telefon bei Erwachsenen), Wohnort-Koordinaten zur Entfernungsberechnung, Angebote, Gesuche, Fotos, Aufträge, Zahlungsstatus, Chatnachrichten, Bewertungen, Favoriten, Meldungen und Blockierungen. Für die Ausweis-Prüfung: Fotos des Ausweises und ein Selfie.' },
        { title: '3. Wer was sehen kann', text: 'Öffentlich (nur für angemeldete Nutzer) sind bei Schülern Vorname, erster Buchstabe des Nachnamens, Alter, Stadt, Beschreibung, Angebote, Arbeitsfotos und Bewertungen. Der Wohnort wird nie angezeigt, nur gerundete Entfernungen. Gesuche zeigen nur die Gegend (ca. 1 km); die Adresse sieht der Schüler erst nach Zusage. Eltern sehen Aufträge, Adresse, vollständigen Namen und Telefonnummer des Auftraggebers sowie den Chat ihres Kindes.' },
        { title: '4. Ausweis-Prüfung', text: 'Die Ausweisbilder liegen verschlüsselt in einem privaten Speicher, nur das Prüfteam hat Zugriff. Nach der Prüfung werden sie gelöscht; gespeichert bleibt nur das Ergebnis. Zugangs- und Seriennummer dürfen geschwärzt werden.' },
        { title: '5. Zweck und Rechtsgrundlage', text: 'Vermittlung und Abwicklung von Aufträgen (Art. 6 Abs. 1 lit. b DSGVO), Schutz Minderjähriger und Missbrauchsabwehr (Art. 6 Abs. 1 lit. f DSGVO), bei Nutzern unter 16 die Einwilligung der Eltern (Art. 8 DSGVO).' },
        { title: '6. Empfänger', text: 'Supabase (Datenbank, Login, Speicher; Serverstandort [EU – Frankfurt]); Zahlungsdienstleister [Name]. Es findet kein Tracking statt. Werbung wird nicht personalisiert.' },
        { title: '7. Speicherdauer', text: 'Chats werden nach Abschluss eines Auftrags ausgeblendet und nach 7 Tagen gelöscht (außer bei offenen Meldungen). Konto und alle Daten können jederzeit in der App gelöscht werden. Zahlungsdaten unterliegen gesetzlichen Aufbewahrungsfristen.' },
        { title: '8. Deine Rechte', text: 'Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch, Widerruf von Einwilligungen und Beschwerde bei einer Aufsichtsbehörde.' },
      ]}
      en={[
        { title: '1. Controller', text: '[Operator name], [address], email: [privacy@your-domain.com]' },
        { title: '2. Data we process', text: 'Account (email, encrypted password), profile (name, date of birth, postal code, city, phone for adults), home coordinates for distance calculation, offers, requests, photos, jobs, payment status, chat messages, reviews, favorites, reports and blocks. For ID checks: photos of the ID document and a selfie.' },
        { title: '3. Who can see what', text: 'Public (logged-in users only) for students: first name, initial of last name, age, city, description, offers, work photos and reviews. Home locations are never shown, only rounded distances. Requests only show the area (approx. 1 km); students see the address after accepting. Parents see their child\'s jobs, address, the client\'s full name and phone number, and the chat.' },
        { title: '4. ID checks', text: 'ID images are stored in private storage accessible only to the review team and deleted after the check; only the result is kept.' },
        { title: '5. Purpose and legal basis', text: 'Arranging and handling jobs (Art. 6(1)(b) GDPR), protecting minors and preventing abuse (Art. 6(1)(f) GDPR), parental consent for users under 16 (Art. 8 GDPR).' },
        { title: '6. Recipients', text: 'Supabase (database, login, storage; servers in [EU – Frankfurt]); payment provider [name]. No tracking. Ads are not personalised.' },
        { title: '7. Retention', text: 'Chats are hidden after a job is completed and deleted after 7 days (unless reports are open). You can delete your account and all data in the app at any time.' },
        { title: '8. Your rights', text: 'Access, rectification, erasure, restriction, portability, objection, withdrawal of consent, and complaint to a supervisory authority.' },
      ]}
    />
  );
}
