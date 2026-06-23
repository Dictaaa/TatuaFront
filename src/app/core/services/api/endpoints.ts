// ============================================================
// TATUA · API Endpoints
// ============================================================

export const ENDPOINTS = {

  // ── Auth ───────────────────────────────────────────────────
  auth: {
    register : '/auth/register',
    login    : '/auth/login',
    logout   : '/auth/logout',
    me       : '/auth/me',
  },

  // ── Artists ────────────────────────────────────────────────
  artists: {
    list      : '/artists',
    create    : '/artists',
    bySlug    : (slug: string)  => `/artists/slug/${slug}`,
    getOne    : (id: number)    => `/artists/${id}`,
    update    : (id: number)    => `/artists/${id}`,
    remove    : (id: number)    => `/artists/${id}`,
  },

  // ── Availability ───────────────────────────────────────────
  availability: {
    schedule        : (artistId: number) => `/artists/${artistId}/availability/schedule`,
    exceptions      : (artistId: number) => `/artists/${artistId}/availability/exceptions`,
    removeException : (artistId: number, id: number) => `/artists/${artistId}/availability/exceptions/${id}`,
    calendar        : (artistId: number) => `/artists/${artistId}/availability/calendar`,
  },

  // ── Bookings ───────────────────────────────────────────────
  bookings: {
    list        : '/bookings',
    create      : '/bookings',
    getOne      : (id: number) => `/bookings/${id}`,
    update      : (id: number) => `/bookings/${id}`,
    cancel      : (id: number) => `/bookings/${id}`,
    changeState : (id: number) => `/bookings/${id}/state`,
    history     : (id: number) => `/bookings/${id}/history`,
    reschedule  : (id: number) => `/bookings/${id}/reschedule`,
  },

  // ── Payments ───────────────────────────────────────────────
  payments: {
    list   : '/payments',
    create : '/payments',
    getOne : (id: number) => `/payments/${id}`,
    update : (id: number) => `/payments/${id}`,
    remove : (id: number) => `/payments/${id}`,
    verify : (id: number) => `/payments/${id}/verify`,
  },

  // ── Reviews ────────────────────────────────────────────────
  reviews: {
    list   : '/reviews',
    create : '/reviews',
    hide   : (id: number) => `/reviews/${id}`,
  },

  // ── Clients ────────────────────────────────────────────────
  clients: {
    list   : '/clients',
    create : '/clients',
    getOne : (id: number) => `/clients/${id}`,
    update : (id: number) => `/clients/${id}`,
    remove : (id: number) => `/clients/${id}`,
  },

  // ── Catalogs ───────────────────────────────────────────────
  catalogs: {
    tattooStyles  : '/tattoo-styles',
    tattooTypes   : '/tattoo-types',
    bodyZones     : '/body-zones',
    tattooSizes   : '/tattoo-sizes',
    paymentMethods: '/payment-methods',
  },

} as const;