(() => {
  const active = location.hash.slice(1);
  const target = active ? document.getElementById(active) : null;

  if (target) {
    document.body.classList.add('exporting');
    document.querySelector('.intro')?.remove();
    document.querySelectorAll('.sheet-frame').forEach((frame) => {
      if (!frame.contains(target)) frame.remove();
    });
  }

  const fitSheets = () => {
    document.querySelectorAll('.sheet-frame').forEach((frame) => {
      const sheet = frame.querySelector('.sheet');
      if (!sheet) return;
      const scale = Math.min(1, frame.clientWidth / 1080);
      sheet.style.setProperty('--sheet-scale', String(scale));
    });
  };
  fitSheets();
  window.addEventListener('resize', fitSheets);
  if (window.ResizeObserver) {
    const gallery = document.querySelector('.gallery');
    if (gallery) new ResizeObserver(fitSheets).observe(gallery);
  }
})();
