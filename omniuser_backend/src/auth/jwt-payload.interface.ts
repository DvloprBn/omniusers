/**
 * Forma real del payload DENTRO del JWT de acceso — firmado, NUNCA cifrado:
 * cualquiera puede decodificarlo sin la llave (es solo Base64), lo que la
 * llave impide es FALSIFICARLO. Por eso nunca va aquí nada verdaderamente
 * secreto.
 */
export interface JwtPayload {
  /** `users.user_id` */
  sub: string;
  /** Nombre real del rol (ej. `"admin"`) — evita una consulta a BD solo para saber el rol en cada request. */
  role: string;
}

/**
 * Lo que queda disponible en `request.user` tras pasar `JwtAuthGuard`.
 * `role`/`mustChangePassword`/`is_active` se leen EN VIVO de Postgres en
 * cada request (ver `JwtStrategy.validate`), nunca se confían del payload
 * del JWT — un rol degradado o una cuenta desactivada deben surtir efecto
 * de inmediato, no hasta que ese access token expire por su cuenta.
 */
export interface AuthenticatedUser {
  userId: string;
  role: string;
  mustChangePassword: boolean;
}

/**
 * Payload real del "challenge token" de corta vida que se emite entre el
 * paso 2 (contraseña correcta) y el paso 3 (código 2FA) del login — NUNCA
 * es un token de sesión real, un `JwtAuthGuard` normal lo rechazaría por no
 * tener `role` (ver `TwoFactorChallengeGuard`/`AuthService.loginStep2`).
 */
export interface TwoFactorChallengePayload {
  sub: string;
  /** Marca literal que distingue este token de un access token real — sin esto, un challenge token robado podría colarse como sesión válida en cualquier endpoint que solo revise la firma. */
  purpose: 'two_factor_challenge';
}
