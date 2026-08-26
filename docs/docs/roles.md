# Jerarquía de roles

`roles` es una tabla real, no un enum fijo de Postgres — un rol nuevo se puede crear sin ningún deploy de código (`POST /roles`). Cada rol tiene un `level` real (autoridad, 0 a 5) y un `max_count` real (tope de cuentas activas, `null` = sin límite).

## Roles sembrados por defecto

| Rol | `level` | `max_count` | Quién es |
|---|---|---|---|
| `usuario` | 0 | sin límite | Cuenta pública autoregistrada — sin acceso al panel |
| `staff` | 1 | sin límite | Operación básica del panel |
| `manager` | 2 | sin límite | Gestiona staff de su área |
| `admin` | 3 | sin límite | Administra manager/staff, usuarios y seguridad |
| `director` | 4 | **1** | Dirección — un solo cargo real |
| `super` | 5 | **1** | Control técnico total — un solo cargo real |

Los 6 están marcados `is_system: true` — nunca se pueden borrar, y `director`/`super` tampoco se pueden renombrar ni cambiar de nivel (romperían la jerarquía de la que depende el resto del sistema).

## La regla real de gestión

`UsersService.assertCanManageRole` (y su espejo en `RolesService.create`/`update`) aplica una sola regla, siempre: **solo puedes crear o gestionar una cuenta — o un rol — de nivel ESTRICTAMENTE MENOR al tuyo.**

- Un `admin` (nivel 3) puede dar de alta `manager`/`staff` (2, 1) — nunca otro `admin`, ni `director`/`super`, ni para editarlo ni para desactivarlo.
- Nadie puede crear un rol nuevo de catálogo con `level` igual o mayor al suyo — evita que alguien se cree, en los hechos, un jefe imaginario con más autoridad que su propio jefe real.

## `max_count` real

Se cuenta solo contra cuentas **activas** (`is_active: true`). Desactivar al Director real libera el cupo de inmediato — nunca hace falta borrar la cuenta anterior (este proyecto nunca borra cuentas, solo desactiva, para preservar el historial real). Al reasignarle el mismo rol a una cuenta que YA lo tiene, esa cuenta se excluye de su propio conteo — confirmarle "director" al Director real no se rechaza por "ya hay 1".

## Verificado real

- Admin (nivel 3) intentando crear un Director (nivel 4) → `403 Forbidden` real.
- Super intentando un segundo Director (`max_count:1`, ya hay 1) → `409 Conflict` real.
- Super intentando crear un rol nuevo de nivel 5 (igual al suyo) → `403 Forbidden` real.

Detalle completo del diseño y la verificación en `DOCUMENTO_VIVO_ARQUITECTURA.md` §3 (raíz del repositorio).
