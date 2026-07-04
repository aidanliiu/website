/**
 * Vercel Speed Insights initialization for static HTML site
 * This script imports and initializes the Speed Insights tracking
 */
import { injectSpeedInsights } from './node_modules/@vercel/speed-insights/dist/index.mjs';

// Initialize Speed Insights with default configuration
injectSpeedInsights({
  debug: true // Enable debug mode in development
});
