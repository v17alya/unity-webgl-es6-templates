// redirects.js
(function () {
  const href = location.href;
  if (href.startsWith('http://localhost') || href.startsWith('http://127.0.0.1')) return;
  if (href.startsWith('http:')) location.replace('https' + href.substring(4));
})();
