const fs = require('fs');
const path = require('path');
const https = require('https');

const slidesJsonPath = path.join(__dirname, 'slides.json');
const slidesOutputDir = path.join(__dirname, 'slides');

// Create slides directory if it doesn't exist
if (!fs.existsSync(slidesOutputDir)) {
  fs.mkdirSync(slidesOutputDir);
}

// Helper to fetch content from URL
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { resolve(data); });
    }).on('error', (err) => { reject(err); });
  });
}

async function main() {
  if (!fs.existsSync(slidesJsonPath)) {
    console.error('slides.json not found! Waiting for the subagent to generate it...');
    process.exit(1);
  }

  const slidesData = JSON.parse(fs.readFileSync(slidesJsonPath, 'utf8'));
  console.log(`Found ${slidesData.length} slides in slides.json. Starting download...`);

  for (const slide of slidesData) {
    const filename = `slide${String(slide.index).padStart(2, '0')}.html`;
    const outputPath = path.join(slidesOutputDir, filename);

    console.log(`Downloading Slide ${slide.index}: ${slide.title}...`);
    try {
      let html = await fetchUrl(slide.htmlUrl);

      // Sanitize the HTML: Inject CSS to hide the default top/bottom navigation bars
      // and inject scrollbar hiding and custom animations.
      const injection = `
  <style>
    /* Hide Stitch default navigation and page framing elements */
    nav, aside, header, footer { display: none !important; }
    /* Reset main margins and layout to make it full screen inside presentation player */
    main {
      margin-left: 0 !important;
      margin-top: 0 !important;
      padding: 0 !important;
      min-height: 100vh !important;
    }
    /* Hide scrollbars */
    body {
      overflow: hidden !important;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    body::-webkit-scrollbar {
      display: none !important;
    }
  </style>
`;
      // Replace remote infographic image with local image reference
      html = html.replace(/https:\/\/lh3\.googleusercontent\.com\/aida\/ADBb0uj1lLkL53p7L-5TuFvmsh8W3qIFGC2p5CwiWb7TfRYz4VJ5NKLbEe9PERf1X26vg-Y5UKYwTugzywn9r6Rb-8AoQy4oLp97RiOKQoITFjsn9rgpoDTU1dpamaz2cmk6BRGaNsJtVo8Wq2LJKkkyoiEx4Lou3FQAb95mRjy6eRXDI_arXZBJTZ1dkPgT6EyzY2Z5dCArVyH9AFvq25Z6tGjDfRuQEvEYjl7NfEkWu5yufTTRmKRVMoDjYw/g, '../Image 1.jpeg');

      html = html.replace('</head>', `${injection}\n</head>`);

      fs.writeFileSync(outputPath, html, 'utf8');
      console.log(`Saved to ${filename}`);
    } catch (err) {
      console.error(`Error downloading slide ${slide.index}:`, err.message);
    }
  }

  console.log('All slides downloaded and sanitized successfully!');
}

main().catch(err => console.error('Error in main execution:', err));
