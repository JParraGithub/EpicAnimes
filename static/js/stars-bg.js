(() => {
  const canvas = document.getElementById("stars");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let W = 0;
  let H = 0;
  let stars = [];

  const resize = () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  };

  const createStars = (count = 160) => {
    stars = Array.from({ length: count }).map(() => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random(),
    }));
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      s.a += (Math.random() - 0.5) * 0.03;
      if (s.a < 0.2) s.a = 0.2;
      if (s.a > 1) s.a = 1;
    }
    requestAnimationFrame(draw);
  };

  window.addEventListener("resize", () => {
    resize();
    createStars(stars.length || 160);
  });

  resize();
  createStars();
  draw();
})();
