/** Traduit les messages d'erreur Supabase en français */
const TRANSLATIONS: Record<string, string> = {
  // Auth
  "Invalid login credentials": "Email ou mot de passe incorrect",
  "Email not confirmed": "Adresse email non confirmée. Vérifie ta boîte mail",
  "User already registered": "Un compte existe déjà avec cet email",
  "Signup requires a valid password": "Le mot de passe doit contenir au moins 6 caractères",
  "Password should be at least 6 characters": "Le mot de passe doit contenir au moins 6 caractères",
  "Unable to validate email address: invalid format": "Format d'email invalide",
  "Email rate limit exceeded": "Trop de tentatives. Réessaie dans quelques minutes",
  "For security purposes, you can only request this after": "Pour des raisons de sécurité, réessaie dans quelques instants",
  "Auth session missing!": "Session expirée. Reconnecte-toi",
  "JWT expired": "Session expirée. Reconnecte-toi",
  "Refresh Token Not Found": "Session expirée. Reconnecte-toi",
  "Token has expired or is invalid": "Session expirée. Reconnecte-toi",
  "New password should be different from the old password": "Le nouveau mot de passe doit être différent de l'ancien",

  // Database / RLS
  "new row violates row-level security policy": "Erreur de permission. Reconnecte-toi",
  "duplicate key value violates unique constraint": "Cet élément existe déjà",
  "violates foreign key constraint": "Impossible de supprimer : cet élément est référencé ailleurs",
  "null value in column": "Un champ obligatoire est manquant",

  // Network
  "Failed to fetch": "Erreur de connexion. Vérifie ta connexion internet",
  "NetworkError": "Erreur réseau. Vérifie ta connexion internet",
  "TypeError: Failed to fetch": "Erreur de connexion. Vérifie ta connexion internet",
  "Load failed": "Échec du chargement. Vérifie ta connexion",
};

export function translateError(message: string): string {
  // Direct match
  if (TRANSLATIONS[message]) return TRANSLATIONS[message];

  // Partial match
  for (const [key, value] of Object.entries(TRANSLATIONS)) {
    if (message.toLowerCase().includes(key.toLowerCase())) return value;
  }

  // Fallback: generic French message
  if (message.includes("password")) return "Erreur liée au mot de passe";
  if (message.includes("email")) return "Erreur liée à l'email";
  if (message.includes("network") || message.includes("fetch")) return "Erreur de connexion";
  if (message.includes("expired") || message.includes("session")) return "Session expirée. Reconnecte-toi";

  return `Une erreur est survenue : ${message}`;
}
