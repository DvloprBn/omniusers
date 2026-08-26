# API (OpenAPI)

Generado en vivo desde el código del backend. El navegador pide el spec directo a `omniuser_backend` (puerto del host, no desde este contenedor) — por eso `omniuser_backend` necesita `http://localhost:8096` en su `ALLOWED_ORIGINS`.

<swagger-ui src="http://localhost:3030/api-json"/>
