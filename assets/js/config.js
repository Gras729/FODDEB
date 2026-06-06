/**
 * FODDEB — assets/js/config.js
 * ─────────────────────────────────────────────────────────────────
 * Constantes publiques côté frontend.
 * À charger en PREMIER dans chaque page HTML, avant api.js et utils.js.
 *
 * Règle : ici uniquement des valeurs PUBLIQUES par design.
 *   - reCAPTCHA SITE key  → publique (Google la valide côté serveur)
 *   - reCAPTCHA SECRET key → reste dans GAS (Script Properties)
 *   - FedaPay clés         → restent dans GAS (Script Properties)
 *   - GAS_URL              → reste dans Vercel env (via /api/gas)
 *
 * Pour modifier la site key : changer ici uniquement, pas dans 5 HTML.
 * ─────────────────────────────────────────────────────────────────
 */

window.FODDEB_CONFIG = Object.freeze({

  // reCAPTCHA v3 — site key publique
  // Changer ici si vous régénérez la clé dans Google Admin Console
  RECAPTCHA_SITE_KEY: '6LdU3tksAAAAAOAIdgtC7xsQURksQ9mHAZ3MVLXF',

  // Proxy API — ne pas modifier
  // L'URL réelle de GAS est dans les variables Vercel, jamais ici
  API_ENDPOINT: '/api/gas',

  // Informations application
  APP_NAME:    'FODDEB',
  APP_VERSION: '2.2.0',

});
