const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Soportar .mjs y .cjs para Firebase v9+ y Supabase
config.resolver.sourceExts.push('mjs', 'cjs');

// Forzar la resolución de tipos de Supabase si es necesario
// config.resolver.resolveRequest = (context, moduleName, platform) => {
//   if (moduleName.startsWith('@supabase/')) {
//     // Lógica personalizada si fuera necesario
//   }
//   return context.resolveRequest(context, moduleName, platform);
// };

module.exports = config;
