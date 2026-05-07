import axios from 'axios';

const CONTENT_SELECTORS = [
  /<article[^>]*>([\s\S]*?)<\/article>/i,
  /<main[^>]*>([\s\S]*?)<\/main>/i,
  /<div[^>]*class="[^"]*(?:abstract|article-body|content|post-content|entry-content|article-content|story-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  /<section[^>]*class="[^"]*(?:abstract|body|content)[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
];

function extractMainContent(html) {
  // Try each selector to find the main content block
  for (const regex of CONTENT_SELECTORS) {
    const match = html.match(regex);
    if (match && match[1] && match[1].length > 500) {
      return match[1];
    }
  }
  // Fallback: return full html for further cleaning
  return html;
}

function cleanHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function scrapeArticle(url) {
  if (!url) return null;
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      responseType: 'text',
    });

    const html = res.data;

    // Try to extract the main content block first
    const mainBlock = extractMainContent(html);
    const content = cleanHtml(mainBlock);

    // If we got a good content block, use it from the start
    // Otherwise skip boilerplate (first 300 chars) like before
    const result = mainBlock !== html
      ? content.slice(0, 8000)
      : content.slice(300, 8000);

    console.log(`[Scraper] Got ${result.length} chars for ${url.slice(0, 60)}`);
    return result;
  } catch (err) {
    console.error(`[Scraper] Failed to scrape ${url}: ${err.message}`);
    return null;
  }
}
