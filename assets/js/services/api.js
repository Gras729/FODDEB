/* ============================================================
   FODDEB — api.js  (assets/js/services/api.js)
   Connecteur Google Apps Script (GAS) — base de données Sheets
   ============================================================ */

/* ── Guard double-inclusion ────────────────────────────────────────────────
   'var' tolère la re-déclaration. config.js doit être chargé avant api.js.
   'document.write' supprimé — config.js est chargé en 1er dans le <head>.
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

// eslint-disable-next-line no-var
var FODDEB_API = window.FODDEB_API || (() => {

  const GAS_URL = '/api/gas';

  /* -------- Requête générique — timeout adaptatif -------- */
  const request = async (action, payload = {}, timeoutMs = 15_000) => {
    const body       = JSON.stringify({ action, ...payload });
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(GAS_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },
        signal:  controller.signal,
        body,
      });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`Erreur réseau : ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError')
        throw new Error('Délai dépassé. Vérifiez votre connexion et réessayez.');
      if (err.message === 'Failed to fetch' || err.message === 'NetworkError when attempting to fetch resource.')
        throw new Error('Impossible de joindre le serveur. Vérifiez votre connexion internet.');
      throw err;
    }
  };

  /* -------- Lecture session robuste (supporte ID/id, Role/role) -------- */
  const getSession = () => {
    try {
      const u = (window.FODDEB && FODDEB.session) ? FODDEB.session.get() : null;
      if (!u) return null;
      return {
        // Normalisation des clés : supporte majuscule et minuscule
        id:   u.ID   || u.id   || '',
        role: u.Role || u.role || 'member',
        raw:  u,
      };
    } catch { return null; }
  };

  /* ============================================================
     AUTHENTIFICATION
  ============================================================ */
  const auth = {
    login:          (identifier, passwordHash, recaptchaToken) =>
                      request('auth_login', { identifier, passwordHash, recaptchaToken }),
    sendOTP:        (userId, email) =>
                      request('auth_send_otp', { userId, email }),
    verifyOTP:      (userId, otp) =>
                      request('auth_verify_otp', { userId, otp }),
    resetPassword:  (email) =>
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
    get:       (id)       => request('members_get', { id }),
    create:    (data)     => request('members_create', data),
    update:    (id, data) => request('members_update', { id, ...data }),
    delete:    (id)       => request('members_delete', { id }),
    validate:  (id)       => request('members_validate', { id }),
    reject:    (id, reason) => request('members_reject', { id, reason }),
    setRole:   (id, role) => request('members_set_role', { id, role }),
    stats:     ()         => request('members_stats'),
    exportCSV: ()         => request('members_export'),

    checkEmail: (email) => request('members_check_email', { email }),
    checkPhone: (phone) => request('members_check_phone', { phone }),
    checkCni:   (cni)   => request('members_check_cni',   { cni }),

    /* ─── Upload fichier PROJET vers Drive ─────────────────────────────
     * FIX : renommé en uploadProjectFile pour éviter le conflit
     * avec uploadFile (inscriptions membres).
     * context   : 'projet'
     * contextId : ID temporaire du projet (ex: 'proj_1717123456789')
     * Retourne  : { success, url, fileName }
     */
    uploadProjectFile: (base64, fileName, mimeType, context, contextId) =>
                         request('upload_file', { base64, fileName, mimeType, context, contextId }, 30_000),

    /* ─── Upload fichier INSCRIPTION membre ────────────────────────────
     * Phase 2 inscription — upload photo/CNI après création du compte
     * memberId : ID du membre dans la feuille Membres
     * fileType : 'photo' | 'cni' | 'autre'
     */
    uploadFile: (memberId, fileType, base64, mime) =>
                  request('member_upload_file', { memberId, fileType, base64, mime }, 30_000),

    /* Phase 3 — email admin après tous les uploads */
    finalize: (memberId) => request('member_finalize', { memberId }),
  };

  /* ============================================================
     DONS
  ============================================================ */
  const dons = {
    list:      (page = 1, filters = {}) => request('dons_list', { page, ...filters }),
    get:       (id)               => request('dons_get', { id }),
    create:    (data)             => request('dons_create', data),
    confirm:   (id, fedapayRef)   => request('dons_confirm', { id, fedapayRef }),
    stats:     ()                 => request('dons_stats'),
    history:   (userId)           => request('dons_history', { userId }),
    exportCSV: ()                 => request('dons_export'),
  };

  /* ============================================================
     PROJETS
  ============================================================ */
  const projets = {
    list: (filters = {}) => {
      /* Injection automatique membreId + role depuis session.
       * getSession() normalise ID/id et Role/role → pas de '' silencieux. */
      const sess = getSession();
      return request('projets_list', {
        membreId: sess ? sess.id   : '',
        role:     sess ? sess.role : 'member',
        ...filters,
      });
    },

    get: (id) => request('projets_get', { id }),

    create: (data) => {
      const sess = getSession();
      return request('projets_create', {
        membreId: sess ? sess.id : '',
        ...data,
      });
    },

    update: (id, data) => {
      const sess = getSession();
      return request('projets_update', {
        id,
        membreId: sess ? sess.id   : '',
        role:     sess ? sess.role : 'member',
        ...data,
      });
    },

    delete: (id) => {
      const sess = getSession();
      return request('projets_delete', {
        id,
        membreId: sess ? sess.id   : '',
        role:     sess ? sess.role : 'member',
      });
    },

    addActivity:    (projetId, data) => request('projets_add_activity', { projetId, ...data }),
    updateProgress: (id, progress)   => request('projets_update_progress', { id, progress }),
    stats:          ()               => request('projets_stats'),
  };

  /* ============================================================
     ACTUALITÉS
  ============================================================ */
  const news = {
    list:    (page = 1, perPage = 10) => request('news_list', { page, perPage }),
    get:     (id)       => request('news_get', { id }),
    create:  (data)     => request('news_create', data),
    update:  (id, data) => request('news_update', { id, ...data }),
    delete:  (id)       => request('news_delete', { id }),
    publish: (id)       => request('news_publish', { id }),
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

  return { auth, members, dons, projets, news, newsletter, contact, dashboard, fedapay };

})();

window.FODDEB_API = FODDEB_API;
