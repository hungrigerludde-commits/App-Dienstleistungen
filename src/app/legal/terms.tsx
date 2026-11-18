import LegalText from '@/components/LegalText';

export default function Terms() {
  return (
    <LegalText
      de={[
        { title: '1. Was StadtHelfer ist', text: 'StadtHelfer vermittelt kleine Hilfsaufträge (z. B. Gartenarbeit, Fensterputzen, Unterricht, Einkäufe, Gassi gehen, Kinderbetreuung, Seniorenhilfe) zwischen Schülerinnen und Schülern ab 14 Jahren und Privatpersonen. [Betreiber] stellt die Plattform bereit und wird nicht Vertragspartner der Aufträge.' },
        { title: '2. Wer mitmachen darf', text: 'Schüler ab 14 Jahren; unter 18 nur mit Zustimmung eines verifizierten Erziehungsberechtigten. Auftraggeber: Privatpersonen ab 18 Jahren. Auftraggeber, Eltern und Schüler ab 16 müssen ihren Ausweis prüfen lassen. Gewerbliche Auftraggeber sind nicht erlaubt.' },
        { title: '3. Jugendschutz', text: 'Es gilt das Jugendarbeitsschutzgesetz. Erlaubt sind nur leichte, geeignete Tätigkeiten. Unter 15 bzw. vollzeitschulpflichtig: max. 2 Std. täglich, nur 8–18 Uhr. Gefährliche Arbeiten (hohe Leitern, Motorsägen, Chemikalien, Dacharbeiten) sind verboten. Als Tagesmutter/-vater darf nur tätig werden, wer volljährig ist und die erforderliche Pflegeerlaubnis (§ 43 SGB VIII) hat.' },
        { title: '4. Bezahlung', text: 'Der Auftraggeber bezahlt nach der Zusage über die App (PayPal, Bank/SEPA, Vivid, Visa). Das Geld wird treuhänderisch über einen Zahlungsdienstleister [Name] verwahrt und ausgezahlt, wenn beide Seiten „Fertig“ bestätigen. Bei Absage wird erstattet. [Gebühren: derzeit keine.]' },
        { title: '5. Verhalten und Moderation', text: 'Respektvoller Umgang ist Pflicht. Verboten sind Belästigung, unangemessene Inhalte, falsche Angaben und das Austauschen privater Kontaktdaten. Nutzer können andere melden und blockieren. Nach drei Meldungen durch verschiedene Personen wird ein Konto vorläufig gesperrt, bis das Moderationsteam den Fall geprüft hat. Bei Meldungen darf das Moderationsteam den zugehörigen Chat einsehen.' },
        { title: '6. Chats', text: 'Wenn beide Seiten einen Auftrag als „Fertig“ bestätigt haben, wird der Chat sofort ausgeblendet und nach 7 Tagen endgültig gelöscht. Liegt eine Meldung vor, wird er bis zur Klärung aufbewahrt.' },
        { title: '7. Fotos', text: 'Hochgeladene Fotos dürfen keine Personen zeigen und keine Rechte Dritter verletzen.' },
        { title: '8. Werbung', text: 'Die App zeigt Werbung. Sie ist nicht personalisiert und als „Anzeige“ gekennzeichnet.' },
        { title: '9. Haftung', text: 'Für Schäden im Rahmen eines Auftrags haften die Beteiligten nach den gesetzlichen Vorschriften. [Haftungsausschluss des Betreibers – anwaltlich formulieren lassen.]' },
        { title: '10. Kontakt', text: '[Betreiber], [Anschrift], [E-Mail]' },
      ]}
      en={[
        { title: '1. What StadtHelfer is', text: 'StadtHelfer connects students aged 14+ with private individuals for small jobs (e.g. gardening, window cleaning, lessons, shopping, dog walking, childcare, senior help). [Operator] provides the platform and is not a party to the jobs.' },
        { title: '2. Who can join', text: 'Students from 14; under 18 only with the consent of a verified legal guardian. Clients: private individuals aged 18+. Clients, parents and students aged 16+ must verify their ID. Commercial clients are not allowed.' },
        { title: '3. Youth protection', text: 'The German Youth Employment Protection Act applies. Only light, suitable work is allowed. Under 15 or in full-time school: max. 2 h per day, only 8 am–6 pm. Dangerous work is prohibited. Only adults with the required care permit may work as a childminder.' },
        { title: '4. Payment', text: 'The client pays through the app after acceptance (PayPal, bank/SEPA, Vivid, Visa). The money is held in escrow by a payment provider [name] and paid out once both sides confirm "Done". Cancelled jobs are refunded.' },
        { title: '5. Conduct and moderation', text: 'Respectful behaviour is required. Harassment, inappropriate content, false information and sharing private contact details are prohibited. Users can report and block others. After three reports by different people an account is suspended until the moderation team has reviewed it. For reports, moderators may view the related chat.' },
        { title: '6. Chats', text: 'Once both sides confirm a job as "Done", the chat is hidden immediately and permanently deleted after 7 days, unless a report requires it to be kept.' },
        { title: '7. Photos', text: 'Uploaded photos must not show people or infringe third-party rights.' },
        { title: '8. Advertising', text: 'The app shows ads. They are not personalised and are labelled "Ad".' },
        { title: '9. Liability', text: 'The parties are liable for damages according to statutory law. [Operator disclaimer – to be drafted by a lawyer.]' },
        { title: '10. Contact', text: '[Operator], [address], [email]' },
      ]}
    />
  );
}
