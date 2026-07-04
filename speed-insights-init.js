// Vercel Speed Insights initialization for static HTML
// This script injects the Speed Insights tracking code
(function() {
  // Initialize the Speed Insights queue
  window.si = window.si || function () { 
    (window.siq = window.siq || []).push(arguments); 
  };

  // Create and inject the Speed Insights script
  var script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/speed-insights/script.js';
  
  script.onerror = function() {
    console.warn('Speed Insights script failed to load. This is expected in development.');
  };
  
  document.head.appendChild(script);
})();
