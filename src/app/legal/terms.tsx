import LegalText from '@/components/LegalText';

export default function Terms() {
  return (
    <LegalText
      sections={[
        {
          title: '1. Was StadtHelfer ist',
          text:
            'StadtHelfer ist eine Plattform, auf der Schülerinnen und Schüler ab 14 Jahren Privatpersonen bei kleinen Aufgaben ' +
            'helfen (z. B. Nachhilfe, Gartenarbeit, Einkäufe). [Betreiber] vermittelt nur den Kontakt und wird nicht Vertragspartner ' +
            'der Aufträge.',
        },
        {
          title: '2. Wer mitmachen darf',
          text:
            'Schüler: ab 14 Jahren; unter 18 nur mit Zustimmung eines Erziehungsberechtigten in der App. ' +
            'Auftraggeber: Privatpersonen ab 18 Jahren, die sich verifizieren lassen. Gewerbliche Auftraggeber sind nicht erlaubt.',
        },
        {
          title: '3. Jugendschutz',
          text:
            'Es gilt das Jugendarbeitsschutzgesetz. Erlaubt sind nur leichte, für Jugendliche geeignete Tätigkeiten. ' +
            'Für unter 15-Jährige und vollzeitschulpflichtige Jugendliche: höchstens 2 Stunden täglich, nur zwischen 8 und 18 Uhr, ' +
            'nicht während des Schulunterrichts. Gefährliche Arbeiten (z. B. auf Leitern in großer Höhe, mit Motorsägen, ' +
            'Chemikalien) sind verboten. Auftraggeber sind dafür verantwortlich, dass die Tätigkeit sicher ist.',
        },
        {
          title: '4. Verhalten',
          text:
            'Respektvoller Umgang ist Pflicht. Verboten sind Belästigung, unangemessene Inhalte, das Austauschen privater ' +
            'Kontaktdaten zur Umgehung der Plattform und falsche Angaben. Verstöße führen zur Sperrung.',
        },
        {
          title: '5. Bezahlung',
          text:
            'Preise vereinbaren Schüler und Auftraggeber selbst. Die Bezahlung erfolgt direkt zwischen ihnen (bar, PayPal oder ' +
            'Überweisung). StadtHelfer [erhebt derzeit keine Gebühren].',
        },
        {
          title: '6. Haftung',
          text:
            'Für Schäden im Rahmen eines Auftrags haften die Beteiligten nach den gesetzlichen Vorschriften. Auftraggeber sollten ' +
            'prüfen, ob ihre private Haftpflichtversicherung Gefälligkeitsdienste abdeckt. [Haftungsausschluss des Betreibers – ' +
            'anwaltlich formulieren lassen.]',
        },
        { title: '7. Kontakt', text: '[Betreiber], [Anschrift], [E-Mail]' },
      ]}
    />
  );
}
