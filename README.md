# 🚗 PlacaPE v2 — Guía de Publicación
## De cero a publicado en 30 minutos

---

## ANTES DE EMPEZAR — Tienes estos archivos:
```
📁 placape2/
├── 📁 frontend/
│   └── index.html          ← Tu página web completa
├── 📁 backend/
│   ├── server.js           ← Backend principal
│   ├── consulta-vehicular.js ← Orquestador scrapers
│   ├── generar-pdf.js      ← Generador de PDF
│   ├── test-consulta.js    ← Script de pruebas
│   ├── package.json        ← Dependencias
│   ├── .env.example        ← Plantilla de credenciales
│   ├── 📁 scrapers/
│   │   ├── scraper-mtc.js
│   │   ├── scraper-sunarp.js
│   │   ├── scraper-sat.js
│   │   ├── scraper-soat-revtec.js
│   │   └── scraper-pnp.js
│   └── 📁 netlify/functions/
│       └── api.js          ← Función serverless
├── netlify.toml            ← Config despliegue
└── .gitignore
```

---

## PASO 1 — ACTIVAR WHATSAPP AUTOMÁTICO (5 min)

1. Abre WhatsApp en tu celular
2. Crea un nuevo contacto con el número: **+34 644 63 97 12**
   (ponle de nombre "CallMeBot")
3. Envíale exactamente este texto:
   ```
   I allow callmebot to send me messages
   ```
4. En menos de 1 minuto recibirás una respuesta con:
   ```
   API Activated for your phone. Your APIKEY is: 1234567
   ```
5. **Guarda ese número** (ej: 1234567) — lo necesitas en el Paso 4

---

## PASO 2 — CONTRASEÑA GMAIL (5 min)

1. Abre en tu computadora: **https://myaccount.google.com**
2. En el menú izquierdo haz clic en **"Seguridad"**
3. Busca **"Verificación en 2 pasos"** y actívala
   (pide tu número de celular, te llega un código)
4. Una vez activada, vuelve a **"Seguridad"**
5. Busca y haz clic en **"Contraseñas de aplicaciones"**
6. En el campo que aparece escribe: **PlacaPE**
7. Haz clic en **"Crear"**
8. Aparece una contraseña de **16 letras** tipo: `abcd efgh ijkl mnop`
9. **Cópiala y guárdala** — solo aparece una vez

---

## PASO 3 — CREAR CUENTA GITHUB Y SUBIR ARCHIVOS (10 min)

1. Ve a **https://github.com** y crea cuenta gratis
2. Haz clic en el botón verde **"New"** (arriba a la izquierda)
3. En "Repository name" escribe: `placape`
4. Selecciona **"Public"**
5. Haz clic en **"Create repository"**
6. En la página que aparece, busca el link que dice:
   **"uploading an existing file"** y haz clic
7. **Descomprime** el ZIP `placape2_completo.zip` en tu computadora
8. **Arrastra y suelta** todos los archivos y carpetas al área de GitHub
9. Espera que suban todos
10. En el campo de abajo escribe: `PlacaPE v2`
11. Haz clic en el botón verde **"Commit changes"**

---

## PASO 4 — PUBLICAR EN NETLIFY (10 min)

1. Ve a **https://netlify.com**
2. Haz clic en **"Sign up"** → elige **"Sign up with GitHub"**
3. Autoriza Netlify a acceder a GitHub
4. Haz clic en **"Add new site"** → **"Import an existing project"**
5. Haz clic en **"Deploy with GitHub"**
6. Selecciona tu repositorio **"placape"**
7. Configura así (exactamente):

| Campo | Valor |
|-------|-------|
| **Base directory** | `backend` |
| **Build command** | `npm install` |
| **Publish directory** | `../frontend` |

8. Haz clic en **"Deploy placape"**
9. Espera 3-5 minutos (verás una barra de progreso)
10. Cuando termine verás una URL como:
    `https://placape-abc123.netlify.app`
    **¡ESA ES TU PÁGINA! Guárdala.**

---

## PASO 5 — CONFIGURAR TUS CREDENCIALES EN NETLIFY (5 min)

⚠️ **ESTE PASO ES OBLIGATORIO — sin él el sistema no funciona**

1. En Netlify ve a tu sitio
2. Haz clic en **"Site configuration"** (menú superior)
3. En el menú izquierdo: **"Environment variables"**
4. Haz clic en **"Add a variable"**
5. Agrega estas **4 variables** una por una:

| Key (nombre) | Value (valor) |
|--------------|---------------|
| `WA_NUMBER` | `51962103328` |
| `WA_APIKEY` | El número de CallMeBot (Paso 1) |
| `GMAIL_USER` | Tu correo Gmail completo |
| `GMAIL_PASS` | Los 16 caracteres del Paso 2 |

6. Una vez agregadas todas, ve a **"Deploys"**
7. Haz clic en **"Trigger deploy"** → **"Deploy site"**
8. Espera 2 minutos

---

## PASO 6 — PRUEBA FINAL

1. Abre tu URL de Netlify
2. Ingresa una placa real, ej: `ABC-123`
3. Pon tu correo Gmail
4. Pon un código Yape cualquiera, ej: `999888777`
5. Haz clic en **"Consultar"** → confirma en el modal
6. Deberías recibir en segundos:
   - ✅ **WhatsApp** en tu 962 103 328 con los datos
   - ✅ **Correo** en tu Gmail con el informe

---

## CÓMO FUNCIONA EL FLUJO AUTOMÁTICO

```
Cliente paga S/20 por Yape
         ↓
Ingresa placa + email + código Yape en la web
         ↓
Netlify recibe la solicitud
         ↓
    ┌────┴────┐
    ↓         ↓
 WhatsApp   Scrapers consultan:
(tú recibes  MTC + SUNARP + SAT
 el aviso)   SAT + PNP + SOAT
                  ↓
            Genera informe
                  ↓
         Email con PDF al cliente
                  ↓
         WhatsApp de confirmación
```

**TÚ NO HACES NADA. Es 100% automático, 24 horas al día.**

---

## COSTOS TOTALES

| Servicio | Costo |
|----------|-------|
| Netlify (hosting) | **GRATIS** |
| GitHub | **GRATIS** |
| CallMeBot WhatsApp | **GRATIS** |
| Gmail | **GRATIS** |
| **TOTAL** | **S/ 0** |

---

## CAMBIAR EL DOMINIO (opcional)

Para tener `www.placape.com` en vez de la URL de Netlify:
1. Compra el dominio en **namecheap.com** (~S/ 40/año)
2. En Netlify: Site configuration → Domain management → Add domain
3. Sigue las instrucciones (5 minutos)

---

## SOPORTE

¿Problemas? Escríbeme por WhatsApp al **962 103 328**

---
*PlacaPE v2 © 2025 · Lima, Perú*
