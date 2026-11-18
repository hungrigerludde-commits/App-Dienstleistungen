import LegalText from '@/components/LegalText';

export default function Safety() {
  return (
    <LegalText
      draft={false}
      sections={[
        { title: '👪 Eltern Bescheid geben', text: 'Sag immer jemandem, wann und wo du einen Auftrag hast und wann du zurück bist. Deine Eltern sehen deine Aufträge auch in ihrer App.' },
        { title: '💬 Im App-Chat bleiben', text: 'Gib keine Telefonnummer, Adresse, Social-Media-Namen oder Fotos von dir heraus. Seriöse Auftraggeber brauchen das nicht.' },
        { title: '✅ Auf das Häkchen achten', text: 'Nur verifizierte Auftraggeber können dich anfragen. Schau dir auch ihre Bewertungen an.' },
        { title: '🚪 Du darfst immer gehen', text: 'Wenn dir etwas komisch vorkommt, brich ab und geh. Du musst nichts tun, was dir unangenehm ist oder gefährlich aussieht.' },
        { title: '⚠️ Keine gefährlichen Arbeiten', text: 'Keine hohen Leitern, keine Motorsägen, keine Chemikalien, nicht aufs Dach. Das ist gesetzlich verboten.' },
        { title: '🚩 Melden', text: 'Über „Melden“ im Profil oder Auftrag erreichst du unser Team. Im Notfall: Polizei 110. Nummer gegen Kummer: 116 111.' },
      ]}
    />
  );
}
