// const API_URL = process.env.NEXT_PUBLIC_API_URL;
// export const authRoutes = {
//   login: `${API_URL}/auth/login`,
//   signup: `${API_URL}/auth/signup`,
//   verifyOtp: `${API_URL}/auth/verify-otp`,
//   resendOtp: `${API_URL}/auth/resend-otp`,
//   forgotPassword: `${API_URL}/auth/forget-password`,
//   resetPassword: `${API_URL}/auth/reset-password`,
//   logout: `${API_URL}/auth/logout`,
// };

// export const userRoutes = {
//   me: `${API_URL}/user/me`,
// };

// export const clinicRoutes = {
//   create: `${API_URL}/clinic`,
//   update: `${API_URL}/clinic`,
//   fetchClinics: (page: number = 1, perPage: number = 10, search: string) =>
//     `${API_URL}/user/clinics?search=${search}&page=${page}&per_page=${perPage}`,
//   delete: `${API_URL}/clinic`,
// };

// export const sectionRoutes = {
//   createSection: `${API_URL}/section`,
//   fetchSections: `${API_URL}/section`,
//   fetchArticleSections: (currentPage: number, pageSize: number) =>
//     `${API_URL}/section/articles?page=${currentPage}&per_page=${pageSize}&lang=en`,
//   editSection: (sectionId: string) => `${API_URL}/section/${sectionId}`,
//   deleteSection: (sectionId: string) => `${API_URL}/section/${sectionId}`,
// };

// export const articlesRoutes = {
//   editArticle: (articleId: string) => `${API_URL}/article/${articleId}`,
//   fetchArticle: (articleId: string) => `${API_URL}/article/${articleId}`,
//   createArticle: `${API_URL}/article?lang=en`,
//   fetchArticles: (page = 1, per_page = 5, search = "") => `${API_URL}/article?search=${search}&page=${page}&per_page=${per_page}`,
//   delete: (articleId: string) => `${API_URL}/article/${articleId}`,
// };

// export const setupRoutes = {
//   createSecretKey: `${API_URL}/api-key`,
//   fetchSecretKeys: (page = 1, per_page = 5) => `${API_URL}/api-key?page=${page}&per_page=${per_page}`,
//   revokeSecretKey: (id: string) => `${API_URL}/api-key/${id}`,
// };
// src/utils/routes.ts

// Authentication Routes
export const authRoutes = {
  login: "/auth/login",
  signup: "/auth/signup",
  verifyOtp: "/auth/verify-otp",
  resendOtp: "/auth/resend-otp",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
  logout: "/auth/logout",
};

// Clinic Routes
// Clinic Routes
export const clinicRoutes = {
  create: "/clinic",
  update: (id: string) => `/clinic/${id}`,
  get: (id: string) => `/clinic/${id}`,
  delete: (id: string) => `/clinic/${id}`,
  fetchClinics: (page: number, perPage: number, search: string) =>
    `/clinic?page=${page}&perPage=${perPage}${search ? `&search=${search}` : ""}`,
};

// User Routes
export const userRoutes = {
  me: "/users/me",
  update: "/users/me",
  list: "/users",
  get: (id: string) => `/users/${id}`,
  updateById: (id: string) => `/users/${id}`,
  delete: (id: string) => `/users/${id}`,
};

// Lead Routes
export const leadRoutes = {
  list: "/leads",
  create: "/leads",
  get: (id: string) => `/leads/${id}`,
  update: (id: string) => `/leads/${id}`,
  delete: (id: string) => `/leads/${id}`,
};

// Lead Source Routes
export const leadSourceRoutes = {
  list: "/lead-sources",
  create: "/lead-sources",
  get: (id: string) => `/lead-sources/${id}`,
  update: (id: string) => `/lead-sources/${id}`,
  delete: (id: string) => `/lead-sources/${id}`,
};

// Thread Routes
export const threadRoutes = {
  list: "/threads",
  create: "/threads",
  get: (id: string) => `/threads/${id}`,
  update: (id: string) => `/threads/${id}`,
  delete: (id: string) => `/threads/${id}`,
  conversations: (id: string) => `/threads/${id}/conversations`,
};

// API Key Routes
export const apiKeyRoutes = {
  list: "/api-keys",
  create: "/api-keys",
  get: (id: string) => `/api-keys/${id}`,
  update: (id: string) => `/api-keys/${id}`,
  delete: (id: string) => `/api-keys/${id}`,
};
