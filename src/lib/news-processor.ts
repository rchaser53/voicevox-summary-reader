import Parser from 'rss-parser';

interface NewsConfig {
  rss_feeds?: string[];
  keywords?: string[];
  summary_length?: number;
  max_articles?: number;
  output_dir?: string;
  output_file?: string;
}

interface Config {
  news?: NewsConfig;
}

interface NewsItem {
  title: string;
  description: string;
  content: string;
  link: string;
  pubDate: string;
  source: string;
}

interface SummarizedNewsItem extends NewsItem {
  summary: string;
}

interface RSSItem {
  title?: string;
  description?: string;
  contentSnippet?: string;
  'content:encoded'?: string;
  link?: string;
  pubDate?: string;
}

interface RSSFeed {
  title?: string;
  items: RSSItem[];
}

/**
 * ニュース処理クラス
 */
export class NewsProcessor {
  private config: Config;
  private parser: any;

  constructor(config: Config) {
    this.config = config;
    this.parser = new Parser({
      customFields: {
        item: ['description', 'content:encoded']
      }
    });
  }

  /**
   * テキストを要約する（簡易版）
   */
  summarizeText(text: string, maxLength: number): string {
    // HTMLタグを除去
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
    
    // 文章を句点で分割
    const sentences = cleanText.split(/[。．！？\n]/).filter(s => s.trim().length > 0);
    
    let summary = '';
    let currentLength = 0;
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) continue;
      
      // 文章を追加しても最大文字数を超えない場合
      if (currentLength + trimmedSentence.length + 1 <= maxLength) {
        summary += (summary ? '。' : '') + trimmedSentence;
        currentLength += trimmedSentence.length + 1;
      } else {
        break;
      }
    }
    
    // 最後に句点を追加
    if (summary && !summary.endsWith('。')) {
      summary += '。';
    }
    
    return summary || cleanText.substring(0, maxLength) + '...';
  }

  /**
   * キーワードがテキストに含まれているかチェック
   */
  containsKeywords(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  /**
   * RSSフィードからニュースを取得
   */
  async fetchNewsFromRSS(feedUrl: string): Promise<NewsItem[]> {
    try {
      console.log(`RSSフィードを取得中: ${feedUrl}`);
      const feed = await this.parser.parseURL(feedUrl) as RSSFeed;
      
      return feed.items.map(item => ({
        title: item.title || '',
        description: item.description || item.contentSnippet || '',
        content: item['content:encoded'] || item.description || '',
        link: item.link || '',
        pubDate: item.pubDate || '',
        source: feed.title || 'Unknown'
      }));
    } catch (error) {
      console.error(`RSSフィードの取得に失敗しました (${feedUrl}):`, (error as Error).message);
      return [];
    }
  }

  /**
   * 複数のRSSフィードからニュースを取得
   */
  async fetchAllNews(): Promise<NewsItem[]> {
    const allNews: NewsItem[] = [];
    const rssFeeds = this.config.news?.rss_feeds || [];
    
    if (rssFeeds.length === 0) {
      console.warn('RSSフィードが設定されていません。');
      return allNews;
    }
    
    for (const feedUrl of rssFeeds) {
      const news = await this.fetchNewsFromRSS(feedUrl);
      allNews.push(...news);
    }
    
    return allNews;
  }

  /**
   * ニュースをフィルタリングして要約
   */
  filterAndSummarizeNews(articles: NewsItem[]): SummarizedNewsItem[] {
    const keywords = this.config.news?.keywords || [];
    const summaryLength = this.config.news?.summary_length || 200;
    
    // キーワードに関連する記事をフィルタリング
    const relevantArticles = articles.filter(article => {
      const searchText = `${article.title} ${article.description} ${article.content}`;
      return this.containsKeywords(searchText, keywords);
    });
    
    // 重複を除去（タイトルベース）
    const uniqueArticles = relevantArticles.filter((article, index, self) => 
      index === self.findIndex(a => a.title === article.title)
    );
    
    // 最大記事数に制限
    const maxArticles = this.config.news?.max_articles || 5;
    const limitedArticles = uniqueArticles.slice(0, maxArticles);
    
    // 各記事を要約
    return limitedArticles.map(article => ({
      ...article,
      summary: this.summarizeText(article.content || article.description, summaryLength)
    }));
  }
}
