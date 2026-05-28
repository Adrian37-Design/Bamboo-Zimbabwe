const fs = require('fs');
const path = require('path');

const slidesJsonPath = path.join(__dirname, 'slides.json');
const slidesOutputDir = path.join(__dirname, 'slides');
const outputHtmlPath = path.join(__dirname, 'presentation.html');

async function main() {
  const slidesData = JSON.parse(fs.readFileSync(slidesJsonPath, 'utf8'));
  console.log(`Loading ${slidesData.length} slides to compile into a single file...`);

  // Load and Base64 encode Image 1.png to make the HTML fully standalone
  const imagePath = path.join(__dirname, 'Image 1.png');
  let imageBase64 = '';
  if (fs.existsSync(imagePath)) {
    console.log(`Encoding Image 1.png to Base64 to support fully self-contained offline standalone mode...`);
    const imageBuf = fs.readFileSync(imagePath);
    imageBase64 = `data:image/png;base64,${imageBuf.toString('base64')}`;
  }

  let compiledStyles = '';
  let compiledSlidesHtml = '';
  
  for (const slide of slidesData) {
    const filename = `slide${String(slide.index).padStart(2, '0')}.html`;
    const filePath = path.join(slidesOutputDir, filename);
    
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}. Please download slides first.`);
      process.exit(1);
    }
    
    const html = fs.readFileSync(filePath, 'utf8');
    const slideIdx = slide.index - 1;
    
    // Extract head style blocks
    const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || [];
    styleMatches.forEach(styleBlock => {
      const css = styleBlock.replace(/<\/?style[^>]*>/g, '');
      // Avoid duplicating the generic reset/hide settings we injected earlier (which can hide player navigation!)
      if (!css.includes('nav { display: none') && 
          !css.includes('Hide Stitch default navigation') &&
          !css.includes('nav, aside, header, footer')) {
        
        // Scope html/body selectors to slide container to prevent leaking background and overflow styles to the main player template
        let scopedCss = css
          .replace(/\bbody\b/g, `#slide-container-${slideIdx}`)
          .replace(/\bhtml\b/g, `#slide-container-${slideIdx}`);
          
        if (imageBase64) {
          // Inline the background image
          scopedCss = scopedCss.replace(/\.\.\/Image 1\.(jpeg|jpg|png)/g, imageBase64).replace(/Image 1\.(jpeg|jpg|png)/g, imageBase64);
        } else {
          scopedCss = scopedCss.replace(/\.\.\//g, '');
        }
          
        compiledStyles += `\n/* Slide ${slide.index} Styles */\n` + scopedCss;
      }
    });

    // Extract body classes (background and surface properties)
    const bodyClassMatch = html.match(/<body[^>]*class="([^"]*)"/);
    let bodyClasses = bodyClassMatch ? bodyClassMatch[1] : '';
    bodyClasses = bodyClasses.replace('overflow-x-hidden', '').trim();

    // Extract main element content
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
    if (!mainMatch) {
      console.error(`No <main> tag found in slide ${slide.index}!`);
      continue;
    }
    
    let mainContent = mainMatch[1];
    
    // Strip inner header and footer from Stitch layout to let the slide flow full-viewport
    mainContent = mainContent.replace(/<header[^>]*>[\s\S]*?<\/header>/g, '');
    mainContent = mainContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/g, '');
    
    // Rewrite asset paths like "../Image 1.jpeg" to Base64 data URI (or remove relative prefixes)
    if (imageBase64) {
      mainContent = mainContent.replace(/\.\.\/Image 1\.(jpeg|jpg|png)/g, imageBase64).replace(/Image 1\.(jpeg|jpg|png)/g, imageBase64);
    } else {
      mainContent = mainContent.replace(/\.\.\//g, '');
    }
    
    // Wrap the content in a slide container
    const isFirst = slide.index === 1;
    compiledSlidesHtml += `
    <!-- Slide ${slide.index}: ${slide.title} -->
    <div class="slide-container ${isFirst ? 'active' : 'hidden'} ${bodyClasses}" id="slide-container-${slideIdx}" data-index="${slideIdx}">
      ${mainContent}
    </div>
    `;
  }

  // Read index.html layout to use it as the wrapper template
  let template = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  // Insert compiled styles
  const styleInjection = `
  <style>
    /* Injected Combined Slide Styles */
    ${compiledStyles}

    /* Slide container widescreen layout formatting */
    .slide-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      pointer-events: none;
      transition: transform var(--transition-speed) cubic-bezier(0.645, 0.045, 0.355, 1), opacity var(--transition-speed) ease;
      z-index: 1;
      overflow-y: auto;
      background-color: #F7FBF1; /* Fallback surface */
      color: #191D17; /* Default dark text color for slides */
    }

    .slide-container.active {
      opacity: 1;
      pointer-events: auto;
      transform: translateX(0) scale(1);
      z-index: 2;
    }

    /* Slide Left transition animations */
    .slide-container.slide-out-left {
      transform: translateX(-100%) scale(0.95);
      opacity: 0;
    }
    .slide-container.slide-in-right {
      transform: translateX(100%) scale(1.05);
      opacity: 0;
    }

    /* Slide Right transition animations */
    .slide-container.slide-out-right {
      transform: translateX(100%) scale(0.95);
      opacity: 0;
    }
    .slide-container.slide-in-left {
      transform: translateX(-100%) scale(1.05);
      opacity: 0;
    }

    /* Slide-specific content overrides (always active to let slide content flow full-viewport inside the player) */
    .slide-container aside,
    .slide-container nav,
    .slide-container header,
    .slide-container footer {
      display: none !important;
    }
    .slide-container main {
      margin-left: 0 !important;
      margin-top: 0 !important;
      padding: 0 !important;
      min-height: 100% !important;
      width: 100% !important;
    }

    /* --- Responsive Overrides --- */
    @media (max-width: 1024px) {
      .side-panel {
        position: absolute !important;
        top: 0;
        left: 0;
        height: 100%;
        z-index: 150;
      }
      .side-panel.collapsed {
        transform: translateX(-100%);
        margin-left: 0 !important; /* Don't shift layout when absolute */
      }
      header {
        padding: 0 16px;
        height: 60px;
      }
      .brand-subtitle {
        display: none !important;
      }
    }

    @media (max-width: 768px) {
      .presentation-canvas {
        padding: 12px !important;
      }
      .viewport {
        aspect-ratio: auto !important;
        height: calc(100vh - 165px) !important;
        min-height: 420px !important;
        border-radius: 12px !important;
      }
      .controls-overlay {
        margin-top: 12px !important;
        padding: 8px 16px !important;
        width: 100% !important;
        max-width: none !important;
      }
      .btn-control {
        padding: 8px 14px !important;
        font-size: 13px !important;
      }
      .presenter-tip {
        display: none !important;
      }
      .floating-btn {
        width: 48px !important;
        height: 48px !important;
      }
      .floating-btn.prev-btn {
        left: 12px !important;
      }
      .floating-btn.next-btn {
        right: 12px !important;
      }
      .floating-exit-btn {
        top: 12px !important;
        right: 12px !important;
        width: 48px !important;
        height: 48px !important;
      }


      .slide-container .min-h-screen {
        min-height: 100% !important;
      }
      .slide-container .h-screen {
        height: auto !important;
      }
      .slide-container section {
        padding-top: 1.5rem !important;
        padding-bottom: 1.5rem !important;
        padding-left: 1rem !important;
        padding-right: 1rem !important;
        min-height: auto !important;
        height: auto !important;
      }
      .slide-container .py-24,
      .slide-container .py-20,
      .slide-container .py-16,
      .slide-container .py-12 {
        padding-top: 1.5rem !important;
        padding-bottom: 1.5rem !important;
      }
      .slide-container .px-20,
      .slide-container .px-12,
      .slide-container .px-8 {
        padding-left: 1rem !important;
        padding-right: 1rem !important;
      }
      .slide-container .p-10,
      .slide-container .p-8 {
        padding: 1rem !important;
      }
      .slide-container .mt-24,
      .slide-container .mt-20,
      .slide-container .mt-16,
      .slide-container .mt-12 {
        margin-top: 1.5rem !important;
      }
      .slide-container .mb-16,
      .slide-container .mb-12,
      .slide-container .mb-8 {
        margin-bottom: 1rem !important;
      }
      .slide-container .grid {
        grid-template-columns: 1fr !important;
        grid-template-rows: none !important;
        grid-auto-rows: auto !important;
        gap: 1rem !important;
      }
      .slide-container .grid-rows-2,
      .slide-container .grid-rows-3,
      .slide-container .grid-rows-4,
      .slide-container .grid-rows-5,
      .slide-container .grid-rows-6 {
        grid-template-rows: none !important;
        grid-auto-rows: auto !important;
      }
      .slide-container .bento-grid {
        display: flex !important;
        flex-direction: column !important;
        gap: 1rem !important;
      }
      .slide-container .bento-grid > div {
        grid-column: span 12 !important;
        grid-row: span 1 !important;
        height: auto !important;
        padding: 1.25rem !important;
      }
      .slide-container .text-7xl,
      .slide-container .text-6xl,
      .slide-container .text-5xl {
        font-size: 1.875rem !important; /* ~30px */
        line-height: 2.25rem !important;
      }
      .slide-container .text-4xl {
        font-size: 1.5rem !important; /* ~24px */
        line-height: 2rem !important;
      }
      .slide-container .text-3xl {
        font-size: 1.25rem !important; /* ~20px */
        line-height: 1.75rem !important;
      }
      .slide-container .text-2xl {
        font-size: 1.125rem !important; /* ~18px */
        line-height: 1.625rem !important;
      }
      .slide-container img {
        height: auto !important;
        max-height: 220px !important;
      }
      .slide-container .h-\[400px\] {
        height: 200px !important;
      }
      /* Improve text contrast of faded/transparent text on mobile */
      .slide-container .text-white\/80 {
        color: rgba(255, 255, 255, 0.95) !important;
      }
      .slide-container .text-white\/70,
      .slide-container .text-white\/60 {
        color: rgba(255, 255, 255, 0.9) !important;
      }
      .slide-container .text-on-surface-variant\/70,
      .slide-container .text-on-surface-variant\/80 {
        color: #424940 !important;
      }
    }
  </style>
  `;

  // Inject Tailwind and custom fonts
  const headInjection = `
  <!-- Tailwind CSS and custom fonts -->
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <script id="tailwind-config">
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            primary: "#0F3823",
            "on-primary": "#FFFFFF",
            "primary-container": "#D2E8D1",
            "on-primary-container": "#00210E",
            secondary: "#52634F",
            "on-secondary": "#FFFFFF",
            surface: "#F7FBF1",
            "on-surface": "#191D17",
            "surface-variant": "#DEE5D8",
            "on-surface-variant": "#424940",
            outline: "#72796F",
            "outline-variant": "#C2C8BC",
            "surface-container-low": "#F1F5EB",
            "surface-container": "#EBF0E5",
            "surface-container-high": "#E5EAE0",
            "surface-container-highest": "#DFE4DA",
            error: "#BA1A1A"
          },
          borderRadius: {
            "DEFAULT": "0.25rem",
            "lg": "0.5rem",
            "xl": "0.75rem",
            "2xl": "1rem",
            "3xl": "1.5rem",
            "full": "9999px"
          },
          fontFamily: {
            headline: ["Public Sans", "sans-serif"],
            display: ["Public Sans", "sans-serif"],
            body: ["Inter", "sans-serif"],
            label: ["Public Sans", "sans-serif"]
          }
        },
      },
    }
  </script>
  ${styleInjection}
  `;

  // Inject in head before </head>
  template = template.replace('</head>', () => `${headInjection}\n</head>`);

  // Replace viewport containing iframes with inline slides
  const iframeViewportPattern = /<div class="viewport" id="viewport">([\s\S]*?)<\/div>/;
  const newViewportHtml = `
      <div class="viewport" id="viewport">
        ${compiledSlidesHtml}

        <!-- Floating Touch/Presentation Controls -->
        <button class="floating-btn prev-btn" id="floating-prev" aria-label="Previous Slide">
          <span class="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <button class="floating-btn next-btn" id="floating-next" aria-label="Next Slide">
          <span class="material-symbols-outlined">arrow_forward_ios</span>
        </button>
        <button class="floating-exit-btn" id="floating-exit" aria-label="Exit Fullscreen">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
  `;
  template = template.replace(iframeViewportPattern, () => newViewportHtml);

  // Replace Javascript logic in index.html with inline transition logic
  const scriptPattern = /<script>\s*\/\/ State Variables[\s\S]*?<\/script>/;
  
  const inlineScript = `
    // Inlined Slides Data
    const slides = ${JSON.stringify(slidesData, null, 2)};
    let currentIdx = 0;
    let isTransitioning = false;
    let autoPlayInterval = null;
    let autoPlayDuration = 8000; // 8 seconds per slide in autoplay
    let timerStart = 0;
    let timerElapsed = 0;
    let timerFrameId = null;

    // Elements
    const slideList = document.getElementById('slide-list');
    const loadingOverlay = document.getElementById('loading-overlay');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const sidePanel = document.getElementById('side-panel');
    const togglePlayBtn = document.getElementById('toggle-play');
    const prevBtn = document.getElementById('prev-slide');
    const nextBtn = document.getElementById('next-slide');
    const currentNumSpan = document.getElementById('current-slide-num');
    const totalNumSpan = document.getElementById('total-slides-num');
    const progressBar = document.getElementById('progress-bar');
    const fullscreenBtn = document.getElementById('btn-fullscreen');
    const viewport = document.getElementById('viewport');
    const timerRing = document.getElementById('timer-ring');
    const timerRingFg = document.getElementById('timer-ring-fg');
    const floatingPrevBtn = document.getElementById('floating-prev');
    const floatingNextBtn = document.getElementById('floating-next');
    const floatingExitBtn = document.getElementById('floating-exit');

    // Initialize Presentation
    async function init() {
      try {
        if (totalNumSpan) totalNumSpan.textContent = slides.length;
        
        // Collapse sidebar by default on smaller viewports
        if (window.innerWidth < 1024) {
          if (sidePanel) sidePanel.classList.add('collapsed');
          if (toggleSidebarBtn) toggleSidebarBtn.innerHTML = '<span class="material-symbols-outlined">menu</span>';
        }

        renderSidebar();
        updateUI();

        // Bind inline cover slide buttons (Explore Data & View Methodology)
        const exploreBtn = document.getElementById('explore-data-btn');
        if (exploreBtn) {
          exploreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            goToSlide(3); // Slide 4: Bamboo Resources & Species (index 3)
          });
        }
        
        const methodologyBtn = document.getElementById('view-methodology-btn');
        if (methodologyBtn) {
          methodologyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            goToSlide(1); // Slide 2: Executive Summary & Introduction (index 1)
          });
        }

        // Hide loader
        if (loadingOverlay) {
          loadingOverlay.style.opacity = '0';
          setTimeout(() => loadingOverlay.style.display = 'none', 500);
        }

      } catch (err) {
        console.error(err);
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = 'Error loading presentation slides.';
        const spinner = document.querySelector('.spinner');
        if (spinner) spinner.style.display = 'none';
      }
    }

    // Render Side Panel List
    // Render Side Panel List
    function renderSidebar() {
      if (!slideList) return;
      slideList.innerHTML = '';
      slides.forEach((slide, index) => {
        const li = document.createElement('li');
        li.className = \`slide-item \${index === 0 ? 'active' : ''}\`;
        li.dataset.index = index;
        li.innerHTML = \`
          <div class="slide-num">\${String(index + 1).padStart(2, '0')}</div>
          <div class="slide-name" title="\${slide.title}">\${slide.title}</div>
        \`;
        li.addEventListener('click', () => {
          if (index !== currentIdx) {
            goToSlide(index);
          }
        });
        slideList.appendChild(li);
      });
    }

    // Go to specific slide with horizontal transitions
    function goToSlide(targetIdx) {
      if (isTransitioning) return;
      isTransitioning = true;
      resetAutoPlayTimer();

      const direction = targetIdx > currentIdx ? 'next' : 'prev';
      
      const currentSlide = document.getElementById(\`slide-container-\${currentIdx}\`);
      const targetSlide = document.getElementById(\`slide-container-\${targetIdx}\`);

      if (!currentSlide || !targetSlide) {
        isTransitioning = false;
        return;
      }

      // Prepare target slide for entry
      targetSlide.className = 'slide-container';

      if (direction === 'next') {
        targetSlide.classList.add('slide-in-right');
      } else {
        targetSlide.classList.add('slide-in-left');
      }

      // Make target visible
      targetSlide.classList.remove('hidden');

      // Force layout recalculation
      targetSlide.offsetHeight;

      // Apply transition animations
      if (direction === 'next') {
        currentSlide.classList.add('slide-out-left');
        targetSlide.classList.remove('slide-in-right');
        targetSlide.classList.add('active');
      } else {
        currentSlide.classList.add('slide-out-right');
        targetSlide.classList.remove('slide-in-left');
        targetSlide.classList.add('active');
      }

      // Wait for transitions to finish
      setTimeout(() => {
        // Clean up previous frame
        currentSlide.className = 'slide-container hidden';
        
        currentIdx = targetIdx;
        isTransitioning = false;
        updateUI();
        
        if (autoPlayInterval) {
          startAutoPlayTimer();
        }
      }, 600); // matches --transition-speed (0.6s)
    }

    // Update UI Status Indicators
    function updateUI() {
      if (currentNumSpan) currentNumSpan.textContent = currentIdx + 1;
      
      // Update sidebar items active state
      if (slideList) {
        const items = slideList.querySelectorAll('.slide-item');
        items.forEach((item, index) => {
          if (index === currentIdx) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            item.classList.remove('active');
          }
        });
      }

      // Update progress bar
      if (progressBar) {
        const progress = ((currentIdx + 1) / slides.length) * 100;
        progressBar.style.width = \`\${progress}%\`;
      }

      // Disable/Enable buttons
      if (prevBtn) prevBtn.disabled = currentIdx === 0;
      if (nextBtn) nextBtn.disabled = currentIdx === slides.length - 1;
    }

    // Autoplay Controls
    function toggleAutoPlay() {
      if (autoPlayInterval) {
        stopAutoPlay();
      } else {
        startAutoPlay();
      }
    }

    function startAutoPlay() {
      if (togglePlayBtn) {
        togglePlayBtn.innerHTML = '<span class="material-symbols-outlined">pause</span>';
        togglePlayBtn.style.background = 'var(--primary)';
        togglePlayBtn.style.color = '#ffffff';
      }
      if (timerRing) timerRing.classList.add('active');
      
      autoPlayInterval = setInterval(() => {
        if (currentIdx < slides.length - 1) {
          goToSlide(currentIdx + 1);
        } else {
          goToSlide(0); // Loop back
        }
      }, autoPlayDuration);

      startAutoPlayTimer();
    }

    function stopAutoPlay() {
      if (togglePlayBtn) {
        togglePlayBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
        togglePlayBtn.style.background = '';
        togglePlayBtn.style.color = '';
      }
      if (timerRing) timerRing.classList.remove('active');
      
      clearInterval(autoPlayInterval);
      autoPlayInterval = null;
      
      resetAutoPlayTimer();
    }

    function startAutoPlayTimer() {
      cancelAnimationFrame(timerFrameId);
      timerStart = Date.now();
      
      function tick() {
        const elapsed = Date.now() - timerStart;
        const percent = Math.min(elapsed / autoPlayDuration, 1);
        
        const offset = 56.5 - (percent * 56.5);
        if (timerRingFg) timerRingFg.style.strokeDashoffset = offset;
        
        if (percent < 1 && autoPlayInterval) {
          timerFrameId = requestAnimationFrame(tick);
        }
      }
      timerFrameId = requestAnimationFrame(tick);
    }

    // Reset autoplay timer ring
    function resetAutoPlayTimer() {
      cancelAnimationFrame(timerFrameId);
      if (timerRingFg) timerRingFg.style.strokeDashoffset = 56.5;
    }

    // Event Listeners
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentIdx > 0) goToSlide(currentIdx - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentIdx < slides.length - 1) goToSlide(currentIdx + 1);
      });
    }

    function handlePrev(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (currentIdx > 0) goToSlide(currentIdx - 1);
    }

    function handleNext(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (currentIdx < slides.length - 1) goToSlide(currentIdx + 1);
    }

    function handleExit(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      exitFullscreenPresentation();
    }

    if (floatingPrevBtn) {
      floatingPrevBtn.addEventListener('click', handlePrev);
      floatingPrevBtn.addEventListener('touchstart', handlePrev, { passive: false });
      floatingPrevBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    }

    if (floatingNextBtn) {
      floatingNextBtn.addEventListener('click', handleNext);
      floatingNextBtn.addEventListener('touchstart', handleNext, { passive: false });
      floatingNextBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    }

    if (floatingExitBtn) {
      floatingExitBtn.addEventListener('click', handleExit);
      floatingExitBtn.addEventListener('touchstart', handleExit, { passive: false });
      floatingExitBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    }

    if (togglePlayBtn) togglePlayBtn.addEventListener('click', toggleAutoPlay);

    if (toggleSidebarBtn) {
      toggleSidebarBtn.addEventListener('click', () => {
        if (sidePanel) {
          sidePanel.classList.toggle('collapsed');
          if (sidePanel.classList.contains('collapsed')) {
            toggleSidebarBtn.innerHTML = '<span class="material-symbols-outlined">menu</span>';
          } else {
            toggleSidebarBtn.innerHTML = '<span class="material-symbols-outlined">menu_open</span>';
          }
        }
      });
    }

    function enterFullscreenPresentation() {
      if (document.body && fullscreenBtn) {
        document.body.classList.add('fullscreen-mode');
        fullscreenBtn.innerHTML = '<span class="material-symbols-outlined">fullscreen_exit</span>';
      }
      
      // Request native fullscreen on viewport
      if (viewport) {
        if (viewport.requestFullscreen) {
          viewport.requestFullscreen().catch(err => {
            console.warn(\`Native fullscreen request failed: \${err.message}\`);
          });
        } else if (viewport.webkitRequestFullscreen) { /* Safari / iOS */
          viewport.webkitRequestFullscreen();
        }
      }
    }

    function exitFullscreenPresentation() {
      if (document.body && fullscreenBtn) {
        document.body.classList.remove('fullscreen-mode');
        fullscreenBtn.innerHTML = '<span class="material-symbols-outlined">fullscreen</span>';
      }
      
      // Exit native fullscreen if currently active
      if (viewport && (document.fullscreenElement === viewport || document.webkitFullscreenElement === viewport)) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    }

    function toggleFullscreenPresentation() {
      const isFullscreen = (document.body && document.body.classList.contains('fullscreen-mode')) || 
                          (viewport && (document.fullscreenElement === viewport || document.webkitFullscreenElement === viewport));
      if (isFullscreen) {
        exitFullscreenPresentation();
      } else {
        enterFullscreenPresentation();
      }
    }

    function handleFullscreenChange() {
      const nativeFullscreen = viewport && (document.fullscreenElement === viewport || document.webkitFullscreenElement === viewport);
      if (!nativeFullscreen && !document.fullscreenElement && !document.webkitFullscreenElement) {
        if (document.body) document.body.classList.remove('fullscreen-mode');
        if (fullscreenBtn) fullscreenBtn.innerHTML = '<span class="material-symbols-outlined">fullscreen</span>';
      }
    }

    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreenPresentation);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // Touch Swipe Gestures
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    if (viewport) {
      viewport.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      viewport.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
      }, { passive: true });
    }

    function handleSwipe() {
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      
      // Ensure horizontal swipe is dominant and exceeds minimum delta of 50px
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0) {
          if (currentIdx > 0) goToSlide(currentIdx - 1);
        } else {
          if (currentIdx < slides.length - 1) goToSlide(currentIdx + 1);
        }
      }
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        if (currentIdx < slides.length - 1) goToSlide(currentIdx + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentIdx > 0) goToSlide(currentIdx - 1);
      }
    });

    // Run Initialization
    init();
  `;

  template = template.replace(scriptPattern, () => `<script>${inlineScript}</script>`);

  // Write compilation output
  fs.writeFileSync(outputHtmlPath, template, 'utf8');
  console.log(`Compilation successful! Single file presentation written to: ${outputHtmlPath}`);

  // Also write to Zimbabwe Bamboo & Rattan Sector.html
  const finalHtmlPath = path.join(__dirname, 'Zimbabwe Bamboo & Rattan Sector.html');
  fs.writeFileSync(finalHtmlPath, template, 'utf8');
  console.log(`Also copied compilation to: ${finalHtmlPath}`);
}

main().catch(err => console.error(err));
