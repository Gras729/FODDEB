/* ============================================================
   FODDEB — api.js  (assets/js/services/api.js)
   Connecteur Google Apps Script (GAS) — base de données Sheets
   ============================================================ */

// Chargement automatique de config.js s'il n'est pas encore présent.
// Evite d'ajouter une balise <script> dans chaque HTML.
if (!window.FODDEB_CONFIG) {
  document.write('<script src="/assets/js/config.js"><\/script>');
}

'use strict';

const FODDEB_API = (() => {

  /* Remplacez par l'URL de votre déploiement GAS */
  // URL du proxy serverless Vercel — GAS_URL est en variable d'environnement côté serveur.
  // Ne jamais remettre l'URL GAS directement ici.
  const GAS_URL = '/api/gas';

  /* -------- Requête générique — timeout 60 s -------- */
  const request = async (action, payload = {}, timeoutMs = 15_000) => {
    const body       = JSON.stringify({ action, ...payload });
    const controller = new AbortController();
    // Timeout adaptatif : 15s par défaut, 30s pour les uploads Drive
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(GAS_URL, {
        method:   'POST',
        headers:  { 'Content-Type': 'text/plain' }, // simple request → pas de preflight CORS
        signal:   controller.signal,
        body,
      });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`Erreur réseau : ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (err) {
      clearTimeout(timer);
      // Traduire les erreurs techniques en messages lisibles
      if (err.name === 'AbortError')
        throw new Error('Délai dépassé (60 s). Vérifiez votre connexion et réessayez.');
      if (err.message === 'Failed to fetch' || err.message === 'NetworkError when attempting to fetch resource.')
        throw new Error('Impossible de joindre le serveur. Vérifiez votre connexion internet.');
      throw err;
    }
  };

  /* ============================================================
     AUTHENTIFICATION
  ============================================================ */
  const auth = {
    login: (identifier, passwordHash, recaptchaToken) =>
      request('auth_login', { identifier, passwordHash, recaptchaToken }),

    sendOTP: (userId, email) =>
      request('auth_send_otp', { userId, email }),

    verifyOTP: (userId, otp) =>
      request('auth_verify_otp', { userId, otp }),

    resetPassword: (email) =>
      request('auth_reset_password', { email }),

    changePassword: (userId, oldHash, newHash) =>
      request('auth_change_password', { userId, oldHash, newHash }),
  };

  /* ============================================================
     MEMBRES
  ============================================================ */
  const members = {
    list:      (page = 1, perPage = 20, search = '') =>
                 request('members_list', { page, perPage, search }),

    get:       (id) =>
                 request('members_get', { id }),

    create:    (data) =>
                 request('members_create', data),

    update:    (id, data) =>
                 request('members_update', { id, ...data }),

    delete:    (id) =>
                 request('members_delete', { id }),

    validate:  (id) =>
                 request('members_validate', { id }),

    reject:    (id, reason) =>
                 request('members_reject', { id, reason }),

    setRole:   (id, role) =>
                 request('members_set_role', { id, role }),

    stats:     () =>
                 request('members_stats'),

    exportCSV: () =>
                 request('members_export'),

    /* Upload fichier vers Google Drive via GAS
     * context   : 'projet' | 'membre'
     * contextId : ID du projet ou du membre (dossier Drive cible)
     * Retourne  : { success, url, fileName }
     */
    uploadFile: (base64, fileName, mimeType, context, contextId) =>
                  request('upload_file', { base64, fileName, mimeType, context, contextId }, 30_000),

    /* Vérifications d'unicité — appels légers, pas de fichier */
    checkEmail: (email) =>
                  request('members_check_email', { email }),
    checkPhone: (phone) =>
                  request('members_check_phone', { phone }),
    checkCni:   (cni)   =>
                  request('members_check_cni',   { cni }),

    /* Phase 2 — upload fichier individuel après création du compte */
    uploadFile: (memberId, fileType, base64, mime) =>
                  request('member_upload_file',  { memberId, fileType, base64, mime }, 30_000),

    /* Phase 3 — email admin après tous les uploads */
    finalize:   (memberId) =>
                  request('member_finalize',     { memberId }),
  };

  /* ============================================================
     DONS
  ============================================================ */
  const dons = {
    list:      (page = 1, filters = {}) => request('dons_list', { page, ...filters }),
    get:       (id)                     => request('dons_get', { id }),
    create:    (data)                   => request('dons_create', data),
    confirm:   (id, fedapayRef)         => request('dons_confirm', { id, fedapayRef }),
    stats:     ()                       => request('dons_stats'),
    history:   (userId)                 => request('dons_history', { userId }),
    exportCSV: ()                       => request('dons_export'),
  };

  /* ============================================================
     PROJETS
  ============================================================ */
  const projets = {
    list:           (filters = {})   => {
      // Injecter automatiquement membreId et role depuis la session
      const user = (window.FODDEB && FODDEB.session) ? FODDEB.session.get() : null;
      return request('projets_list', {
        membreId: (user && user.ID)   || '',
        role:     (user && user.Role) || 'member',
        ...filters,
      });
    },
    get:            (id)             => request('projets_get', { id }),
    create:         (data)           => {
      // Injecter automatiquement membreId depuis la session
      const user = (window.FODDEB && FODDEB.session) ? FODDEB.session.get() : null;
      return request('projets_create', {
        membreId: (user && user.ID) || '',
        ...data,
      });
    },
    update:         (id, data)       => {
      const user = (window.FODDEB && FODDEB.session) ? FODDEB.session.get() : null;
      return request('projets_update', {
        id,
        membreId: (user && user.ID)   || '',
        role:     (user && user.Role) || 'member',
        ...data,
      });
    },
    delete:         (id)             => {
      const user = (window.FODDEB && FODDEB.session) ? FODDEB.session.get() : null;
      return request('projets_delete', {
        id,
        membreId: (user && user.ID)   || '',
        role:     (user && user.Role) || 'member',
      });
    },
    addActivity:    (projetId, data) => request('projets_add_activity', { projetId, ...data }),
    updateProgress: (id, progress)   => request('projets_update_progress', { id, progress }),
    stats:          ()               => request('projets_stats'),
  };

  /* ============================================================
     ACTUALITES
  ============================================================ */
  const news = {
    list:    (page = 1, perPage = 10) => request('news_list', { page, perPage }),
    get:     (id)                     => request('news_get', { id }),
    create:  (data)                   => request('news_create', data),
    update:  (id, data)               => request('news_update', { id, ...data }),
    delete:  (id)                     => request('news_delete', { id }),
    publish: (id)                     => request('news_publish', { id }),
  };

  /* ============================================================
     NEWSLETTER
  ============================================================ */
  const newsletter = {
    subscribe:   (email, nom = '') => request('newsletter_subscribe', { email, nom }),
    unsubscribe: (email)           => request('newsletter_unsubscribe', { email }),
    list:        ()                => request('newsletter_list'),
    send:        (subject, body, test = false) => request('newsletter_send', { subject, body, test }),
    stats:       ()                => request('newsletter_stats'),
  };

  /* ============================================================
     CONTACT
  ============================================================ */
  const contact = {
    send: (data) => request('contact_send', data),
    list: ()     => request('contact_list'),
  };

  /* ============================================================
     TABLEAU DE BORD
  ============================================================ */
  const dashboard = {
    stats:         ()                 => request('dashboard_stats'),
    recentDons:    (limit = 5)        => request('dashboard_recent_dons', { limit }),
    recentMembers: (limit = 5)        => request('dashboard_recent_members', { limit }),
    chartDons:     (period = 'month') => request('dashboard_chart_dons', { period }),
    chartMembers:  (period = 'month') => request('dashboard_chart_members', { period }),
    alerts:        ()                 => request('dashboard_alerts'),
  };

  /* ============================================================
     FEDAPAY — Paiement
  ============================================================ */
  const fedapay = {
    initTransaction: (amount, customer, description) =>
                       request('fedapay_init', { amount, customer, description }),
    checkStatus:     (transactionId) =>
                       request('fedapay_status', { transactionId }),
  };

  /* -------- Public API -------- */
  return { auth, members, dons, projets, news, newsletter, contact, dashboard, fedapay };

})();

window.FODDEB_API = FODDEB_API;
