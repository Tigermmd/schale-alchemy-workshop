(() => {
  const active = location.hash.slice(1);
  if (!active) return;

  const target = document.getElementById(active);
  if (!target) return;

  document.body.classList.add('exporting');
  document.querySelector('.intro')?.remove();
  document.querySelectorAll('.sheet').forEach((sheet) => {
    if (sheet !== target) sheet.remove();
  });
})();
