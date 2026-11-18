import LegalText from '@/components/LegalText';

export default function Safety() {
  return (
    <LegalText
      draft={false}
      de={[
        { title: '👪 Eltern wissen Bescheid', text: 'Deine Eltern sehen in ihrer App, wann, wo und bei wem du arbeitest – und können im Notfall eingreifen.' },
        { title: '💬 Im App-Chat bleiben', text: 'Gib keine Telefonnummer, Social-Media-Namen oder Fotos von dir heraus.' },
        { title: '✅ Auf „Verifiziert“ achten', text: 'Alle Auftraggeber haben ihren Ausweis prüfen lassen. Schau dir auch die Bewertungen an.' },
        { title: '🚪 Du darfst immer gehen', text: 'Wenn dir etwas komisch vorkommt, brich ab und geh. Du musst nichts tun, was gefährlich aussieht.' },
        { title: '⚠️ Keine gefährlichen Arbeiten', text: 'Keine hohen Leitern, keine Motorsägen, keine Chemikalien, nicht aufs Dach.' },
        { title: '🚩 Melden', text: 'Über „Melden“ erreichst du unser Team. Im Notfall: Polizei 110. Nummer gegen Kummer: 116 111.' },
      ]}
      en={[
        { title: '👪 Parents stay informed', text: 'Your parents see in their app when, where and for whom you work – and can step in if needed.' },
        { title: '💬 Stay in the app chat', text: "Don't share your phone number, social media names or photos of yourself." },
        { title: '✅ Look for "Verified"', text: 'All clients have had their ID checked. Also look at their reviews.' },
        { title: '🚪 You can always leave', text: "If something feels wrong, stop and leave. You don't have to do anything that looks dangerous." },
        { title: '⚠️ No dangerous work', text: 'No high ladders, chainsaws, chemicals or roofs.' },
        { title: '🚩 Report', text: 'Use "Report" to reach our team. In an emergency: police 110. Nummer gegen Kummer: 116 111.' },
      ]}
    />
  );
}
