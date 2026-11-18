import { router } from 'expo-router';

/** Zurück – oder zur Startseite, falls es keinen Verlauf gibt (z. B. nach einem Link). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
