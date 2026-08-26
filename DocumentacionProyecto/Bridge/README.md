# Bridge — conocimiento reutilizable entre proyectos

> "Bridge" (puente) porque conecta lo aprendido en un proyecto real con el siguiente, sin que se pierda entre carpetas. No es la documentación de ningún negocio en particular — todo aquí está deliberadamente generalizado, sin nombre de marca, para que sirva igual en DeliDogy, en TecnoSolutions, y como insumo real para diseñar OmniSkeleton.

## La secuencia de proyectos (para dar contexto a estos documentos)

1. **Inari** — gestión patrimonial personal. MVP completo.
2. **Espiral Cultura Urbana** — ecommerce híbrido (ropa/skate + producto restringido + citas de tatuaje + POS físico). En producción real desde 2026-08-21.
3. **DeliDogy** — ecommerce de productos para mascotas, tamaño/funcionalidades comparables a Espiral, con una dimensión nueva: fabricación propia del producto. *(Este proyecto.)*
4. **TecnoSolutions** — la tienda #3, todavía sin diseñar.
5. **OmniSkeleton** — **no es una tienda**. Es el framework/esqueleto reutilizable que se construye DESPUÉS de tener 3 tiendas reales (Espiral, DeliDogy, TecnoSolutions) — la decisión deliberada fue no modularizar/abstraer de forma prematura antes de ver 3 casos reales de negocio híbrido. Esta carpeta (`Bridge/`) es, en la práctica, el borrador vivo de lo que OmniSkeleton terminará formalizando.

## Qué hay aquí

- **`GUIA_DESPLIEGUE.md`** — cómo subir cambios a un servidor de producción con Docker Compose + Vultr, paso a paso, sin nombre de marca.
- **`LECCIONES_ARQUITECTURA.md`** — patrones técnicos concretos aprendidos a la mala en Espiral (bugs reales, causa raíz, cómo se corrigieron) — para no repetirlos.
- **`CHECKLIST_SEGURIDAD_PRELANZAMIENTO.md`** — checklist accionable destilado de la auditoría de seguridad real de Espiral (20 hallazgos) — para correr proactivo, no para descubrir los mismos bugs de nuevo.

## Regla de mantenimiento (para evitar que esto se desalinee con el tiempo)

- Algo específico del negocio de DeliDogy (una decisión de marca, un dato real de su catálogo) → va solo en la documentación viva del proyecto, en la raíz (`../../CLAUDE.md`, `../../ESTADO_PROYECTO.md`, etc. — dos niveles arriba de `Bridge/`).
- Un patrón técnico reutilizable descubierto trabajando en DeliDogy (o en cualquier proyecto futuro) → se escribe completo y generalizado aquí en `Bridge/`, y en la documentación del proyecto específico solo queda una línea corta que apunta hacia acá — nunca la misma historia completa duplicada en los dos lados.
- Cuando DeliDogy y TecnoSolutions ya existan como código real, esta carpeta es el punto de partida para decidir qué se extrae de verdad a un paquete compartido de OmniSkeleton — no antes.
