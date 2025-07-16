/**
 * ウェブサイトコンテンツ取得モジュール
 */
import axios from 'axios';

/**
 * ウェブサイトからテキストを取得する関数
 * @param url - 取得するウェブサイトのURL
 * @returns 取得したHTMLコンテンツ
 * @throws 取得に失敗した場合のエラー
 */
export async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    console.log(`🌐 ウェブサイトからコンテンツを取得中: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000 // 30秒のタイムアウト
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`❌ ウェブサイトの取得に失敗しました: ${(error as Error).message}`);
    throw error;
  }
}
