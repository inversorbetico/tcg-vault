// Configuración pública de Supabase (clave "publishable": segura para el
// navegador, sin acceso de administrador). No contiene secretos.
window.SUPABASE_URL = "https://qcnzkfmxzxlwqjwkxdph.supabase.co";
window.SUPABASE_KEY = "sb_publishable_lmgHI7osK3me9NAFmKG_eQ_03eKGTKZ";

// PIN de acceso a la app. Ahora también lo exige Supabase (RLS) para poder
// leer o escribir cualquier tabla, así que si lo cambiáis aquí hay que
// actualizar también las políticas "pin_gate" en el SQL Editor de Supabase
// (si no, la app se queda sin acceso a los datos).
window.APP_PIN = "2026";
