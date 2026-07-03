document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('main-header');
  const burger = document.querySelector('.burger');
  const navLinks = document.querySelector('.nav-links');
  const navOverlay = document.querySelector('.nav-overlay');

  // ── Burger menu ──
  if (burger) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('active');
      navLinks.classList.toggle('open');
      if (navOverlay) navOverlay.classList.toggle('active');
      document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
    });
    if (navOverlay) {
      navOverlay.addEventListener('click', () => {
        burger.classList.remove('active');
        navLinks.classList.remove('open');
        navOverlay.classList.remove('active');
        document.body.style.overflow = '';
      });
    }
  }

  // ── Header scroll-shrink ──
  function handleScroll() {
    if (!header) return;
    if (window.scrollY > 60) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // ── Fade-in on scroll ──
  const animated = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right, .stagger-children');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  animated.forEach((el) => observer.observe(el));

  // ── Hero carousel (page d'accueil uniquement) ──
  const carousel = document.getElementById('hero-carousel');
  if (carousel) {
    const slides = carousel.querySelectorAll('.carousel-slide');
    const dots = carousel.querySelectorAll('.carousel-dot');
    const prevBtn = carousel.querySelector('.carousel-arrow--prev');
    const nextBtn = carousel.querySelector('.carousel-arrow--next');
    const progressBar = carousel.querySelector('.carousel-progress');
    let current = 0;
    const total = slides.length;
    const interval = 5000;
    let timer = null;

    function goToSlide(index) {
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = (index + total) % total;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
      startProgress();
    }
    function nextSlide() { goToSlide(current + 1); }
    function prevSlide() { goToSlide(current - 1); }

    function startProgress() {
      if (!progressBar) return;
      progressBar.style.transition = 'none';
      progressBar.style.width = '0%';
      void progressBar.offsetWidth;
      progressBar.style.transition = 'width ' + interval + 'ms linear';
      progressBar.style.width = '100%';
    }
    function startAutoPlay() {
      stopAutoPlay();
      timer = setInterval(nextSlide, interval);
      startProgress();
    }
    function stopAutoPlay() {
      if (timer) clearInterval(timer);
    }

    if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); startAutoPlay(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); startAutoPlay(); });
    dots.forEach((dot, i) => dot.addEventListener('click', () => { goToSlide(i); startAutoPlay(); }));

    let touchStartX = 0;
    carousel.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    carousel.addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) nextSlide(); else prevSlide();
        startAutoPlay();
      }
    }, { passive: true });

    startAutoPlay();
  }

  // ── Mentions légales modal ──
  const mentionsModal = document.getElementById('mentions-modal');
  const linkMentions = document.getElementById('link-mentions');
  const closeMentions = document.getElementById('close-mentions');
  if (mentionsModal && linkMentions && closeMentions) {
    linkMentions.addEventListener('click', (e) => {
      e.preventDefault();
      mentionsModal.style.display = 'block';
    });
    closeMentions.addEventListener('click', () => { mentionsModal.style.display = 'none'; });
    mentionsModal.addEventListener('click', (e) => {
      if (e.target === mentionsModal) mentionsModal.style.display = 'none';
    });
  }
});
