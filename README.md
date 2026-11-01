# 👑 TopTop

**TopTop** es una aplicación multiplataforma (iOS, Android y Web) desarrollada con **React Native** y **Expo** diseñada para descubrir, clasificar y compartir los mejores establecimientos, planes y joyas ocultas (*Hidden Gems*) tanto cerca de ti como a nivel global.

---

## ✨ Características Principales

- 🏆 **Rankings Locales y Globales**: Explora clasificaciones dinámicas por categorías (*Top Mundial*, *Para Ti*, *Gastronomía*, *Ocio Nocturno*, *Moda*, *Belleza*, *Hogar*, etc.).
- 💎 **Hidden Gems (Joyas Ocultas)**: Carrusel dedicado a lugares especiales y secretos mejor valorados de cada zona.
- 🗺️ **Mapa Interactivo y Geolocalización**: Visualiza establecimientos cercanos en tiempo real, filtra por categoría o explora cualquier ciudad del mundo cambiando tu ubicación manualmente.
- ⭐ **Reseñas Multimedia Detalladas**: Valora establecimientos con puntuaciones desglosadas (*Calidad*, *Precio/Valor*, *Fiabilidad*), sube fotos y vídeos con miniaturas generadas automáticamente y participa en los comentarios.
- 👥 **Comunidad, Listas y Gamificación**:
  - Perfiles de usuario con sistema de rangos e insignias (*Badges*).
  - Creación y gestión de listas personalizadas de lugares favoritos e historial de visitas.
  - Red social integrada (seguidores, seguidos y actividad).
  - Generación de tarjetas visuales (`SocialShareCard`) listas para compartir en redes sociales.
- 🔔 **Notificaciones de Proximidad**: Alertas inteligentes cuando te encuentras cerca de lugares destacados o guardados.
- 🛡️ **Seguridad y Personalización**:
  - Autenticación con correo/contraseña y **Google Sign-In**.
  - Protección mediante autenticación biométrica (Huella / Face ID).
  - Modo Oscuro / Claro adaptable al sistema, soporte multi-idioma (**ES / EN**) y filtro especializado **Halal**.

---

## 🛠️ Stack Tecnológico

- **Framework:** [React Native](https://reactnative.dev/) (0.81) + [Expo SDK 54](https://expo.dev/)
- **Navegación:** [Expo Router v6](https://docs.expo.dev/router/introduction/) (enrutamiento basado en archivos y rutas tipadas)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Backend y Base de Datos:**
  - [Supabase](https://supabase.com/) (Base de datos relacional, perfiles, reseñas, listas y almacenamiento multimedia)
  - [Firebase](https://firebase.google.com/) (Auth, Firestore, Storage y Hosting Web)
- **Mapas y Ubicación:** `react-native-maps`, `expo-location` y **Google Places & Maps API**
- **UI y Animaciones:** `react-native-reanimated`, `lucide-react-native`, `expo-linear-gradient`, `expo-blur`
- **Multimedia y Dispositivo:** `expo-av`, `expo-image-picker`, `expo-video-thumbnails`, `expo-notifications`, `expo-local-authentication`, `react-native-view-shot`

---

## 📁 Estructura del Proyecto

```text
toptop_app/
├── app/                        # Pantallas y rutas (Expo Router)
│   ├── (tabs)/                 # Navegación principal (Top, Mapa, Perfil)
│   ├── establishment/[id].tsx  # Detalle de establecimiento
│   ├── gems/                   # Vista de Hidden Gems
│   ├── ranking/[id].tsx        # Detalle de rankings por categoría
│   ├── review/                 # Creación y visualización de reseñas
│   ├── user/[id].tsx           # Perfil público de usuarios
│   └── ...                     # Login, registro, ajustes, notificaciones, listas
├── components/                 # Componentes reutilizables (RankingBlock, GemCarousel, SocialShareCard...)
├── config/                     # Configuración de clientes (Supabase, Firebase, Google Auth)
├── constants/                  # Paletas de colores y temas (Claro / Oscuro)
├── context/                    # Contextos globales (AuthContext, SettingsContext, GlobalUIContext)
├── hooks/                      # Custom hooks (useProximityNotifications)
├── services/                   # Lógica de negocio y llamadas a APIs (establecimientos, mapas, perfiles, listas...)
├── utils/                      # Utilidades, definiciones de rankings y formateadores
├── assets/                     # Iconos, fuentes e imágenes estáticas
└── app.json                    # Configuración del proyecto Expo
```

---

## 🚀 Instalación y Puesta en Marcha

### 1. Requisitos previos

- [Node.js](https://nodejs.org/) (v18 o superior recomendado)
- `npm` o `yarn`
- Aplicación **Expo Go** en tu dispositivo móvil o un emulador configurado (**Android Studio** / **Xcode**)

### 2. Clonar el repositorio e instalar dependencias

```bash
git clone <URL_DEL_REPOSITORIO>
cd toptop_app
npm install
```

### 3. Configuración de Servicios

Asegúrate de contar con las credenciales necesarias en los archivos de configuración:

- **Supabase:** Configura `supabaseUrl` y `supabaseAnonKey` en `config/supabase.ts`.
- **Firebase:** Verifica las credenciales en `config/firebase.ts` y el archivo `services/google-services.json` para Android.
- **Google Maps API:** Verifica la clave de API configurada en `app.json` (`ios.config.googleMapsApiKey` y `android.config.googleMaps.apiKey`) y en `services/googleMapsService.ts`.

### 4. Ejecutar la aplicación

```bash
# Iniciar el servidor de desarrollo de Expo
npm start

# Ejecutar en Android (compilación nativa)
npm run android

# Ejecutar en iOS (compilación nativa - requiere macOS)
npm run ios

# Ejecutar en navegador Web
npm run web
```

---

## 📦 Compilación y Despliegue (EAS & Firebase)

- **EAS Build (Android / iOS):**
  El proyecto incluye configuración en `eas.json` para generar compilaciones de desarrollo, previsualización (APK) y producción:
  ```bash
  npx eas build --platform android --profile preview
  ```
- **Firebase Hosting (Web):**
  Configurado mediante `firebase.json` para desplegar la exportación estática web en la carpeta `public`.

---

## 📄 Licencia

Este proyecto es privado y todos los derechos están reservados.

