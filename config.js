/* Configuración pública de la app.
 * La URL y la "anon key" de Supabase NO son secretas: están pensadas para ir en la app.
 * La seguridad la dan el cifrado de extremo a extremo y las reglas de acceso (RLS) del servidor.
 * Si las dejas así, la app funciona solo en modo "este dispositivo". */
window.GASTOS_CONFIG = {
  supabaseUrl: 'TU_SUPABASE_URL',
  supabaseAnonKey: 'TU_SUPABASE_ANON_KEY',
};
