import { ChatOpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { loadSummarizationChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";
import * as fs from 'fs';
import * as path from 'path';
import { TextSplitter } from './text-splitter';
import { cleanText, getLengthInstruction } from './text-utils';
import { fetchWebsiteContent } from './website-fetcher';
import * as dotenv from 'dotenv';

dotenv.config();

interface ProcessResult {
  url: string;
  summaryFile: string;
  createdFiles: string[];
  summary: string;
  outputDir: string;
}

interface Article {
  title: string;
  summary: string;
  source: string;
  pubDate: string;
  link: string;
}

interface SummaryResponse {
  text: string;
}

/**
 * 単一URLの要約処理
 * @param url 要約するURL
 * @param outputDir 出力ディレクトリ
 * @param summaryLength 要約の長さ（short, medium, long）
 * @returns 要約結果オブジェクトまたはnull（エラー時）
 */
export async function processUrl(url: string, outputDir: string, summaryLength: string): Promise<ProcessResult | null> {
  try {
    console.log(`\n🌐 対象URL: ${url}`);
    console.log(`📁 出力ディレクトリ: ${outputDir}`);
    console.log(`📏 要約の長さ: ${summaryLength}\n`);
    
    // 進行度ロガーを初期化（推定ステップ数）
    const { ProgressLogger } = await import('./progress-logger');
    const logger = new ProgressLogger(6);
    logger.logStep('設定の初期化完了');
    
    // ウェブサイトからコンテンツを取得
    const htmlContent = await fetchWebsiteContent(url);
    logger.logStep('ウェブサイトコンテンツの取得完了');
    
    // HTMLからテキストを抽出してクリーニング
    const text = cleanText(htmlContent);
    
    // テキストが空でないことを確認
    if (!text || text.length === 0) {
      console.error(`❌ エラー: ${url} から処理可能なテキストが見つかりません`);
      return null;
    }
    
    console.log(`📊 処理するテキストの長さ: ${text.length.toLocaleString()}文字`);
    
    // OpenAIモデル初期化
    const llm = new ChatOpenAI({
      temperature: 0.1,
      modelName: "gpt-4o-mini",
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
       baseURL: process.env.OPENAI_API_URL,
      },
      maxConcurrency: 1,
      maxRetries: 0,
    });
    
    // レート制限インスタンスを作成
    const { TokenRateLimiter } = await import('./token-rate-limiter');
    const rateLimiter = new TokenRateLimiter(200, 150000, 60000);
    
    // テキストを文書オブジェクトに変換
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 30000,
      chunkOverlap: 1000,
    });
    const documents = await splitter.createDocuments([text]);
    
    console.log(`📑 文書の分割数: ${documents.length}個`);
    console.log(`🔢 予想リクエスト数: ${documents.length + 1}回\n`);
    
    logger.logStep('テキスト分割完了');
    
    // カスタムプロンプトテンプレートを作成
    const mapPrompt = PromptTemplate.fromTemplate(`
${getLengthInstruction(summaryLength)}

テキスト: {text}

要約:`);

    const combinePrompt = PromptTemplate.fromTemplate(`
${getLengthInstruction(summaryLength)}

要約リスト:
{text}

最終要約:`);
    
    // 要約チェーンを作成
    const chain = await loadSummarizationChain(llm as any, {
      type: "map_reduce",
      combineMapPrompt: mapPrompt,
      combinePrompt: combinePrompt,
    });
    
    logger.logStep('要約チェーンの作成完了');
    
    // 各チャンクを順次処理（トークン制限対応）
    console.log('🤖 AIによる要約処理を実行中...');
    
    const estimatedTokensPerChunk = Math.ceil(30000 / 4);
    
    for (let i = 0; i < documents.length; i++) {
      await rateLimiter.waitIfNeeded(estimatedTokensPerChunk);
      console.log(`📝 チャンク ${i + 1}/${documents.length} を処理中...`);
    }
    
    // 最終的な要約を実行
    await rateLimiter.waitIfNeeded(estimatedTokensPerChunk);
    const summary = await chain.invoke({
      input_documents: documents,
    }) as SummaryResponse;
    
    logger.logStep('要約処理完了');
    
    // 出力ディレクトリを作成
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 日付ディレクトリを作成（YYYY-MM-DD形式）
    const today = new Date();
    const dateStr = today.getFullYear() + '-' + 
                   String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(today.getDate()).padStart(2, '0');
    const dateOutputDir = path.join(outputDir, dateStr);
    if (!fs.existsSync(dateOutputDir)) {
      fs.mkdirSync(dateOutputDir, { recursive: true });
    }
    
    // URLからサブディレクトリ名を生成
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/\./g, '_');
    const pathname = urlObj.pathname.replace(/\//g, '_').replace(/\./g, '_');
    const urlSubdir = `${hostname}${pathname}`.substring(0, 50); // 長すぎる場合は切り詰める
    
    // 日付ディレクトリの下にURLごとのサブディレクトリを作成
    const urlOutputDir = path.join(dateOutputDir, urlSubdir);
    if (!fs.existsSync(urlOutputDir)) {
      fs.mkdirSync(urlOutputDir, { recursive: true });
    }
    
    // TextSplitterを使用してファイルを分割・出力
    const splitterConfig = {
      news: {
        reading: {
          split_files: true,
          max_chars_per_file: 100,
          include_metadata: true,
          output_prefix: 'website_summary_'
        }
      }
    };
    
    const textSplitter = new TextSplitter(splitterConfig);
    
    // 要約結果を記事形式に変換
    const summarizedArticles: Article[] = [{
      title: `ウェブサイト要約: ${url}`,
      summary: summary.text,
      source: url,
      pubDate: new Date().toLocaleString('ja-JP'),
      link: url
    }];
    
    // 分割されたファイルを作成
    const createdFiles = textSplitter.createReadingFiles(summarizedArticles, urlOutputDir);
    
    // 要約結果をまとめたファイルも作成
    const summaryFile = textSplitter.outputSummaryToFile(
      summarizedArticles, 
      urlOutputDir, 
      'website_summary_report.md'
    );
    
    logger.logStep('ファイル出力完了');
    logger.logComplete();
    
    console.log('=== 要約結果 ===');
    console.log(summary.text);
    console.log('\n=== 作成されたファイル ===');
    console.log(`📄 要約レポート: ${summaryFile}`);
    console.log('📄 分割ファイル:');
    createdFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
    
    return {
      url,
      summaryFile,
      createdFiles,
      summary: summary.text,
      outputDir: urlOutputDir
    };
    
  } catch (error) {
    console.error(`❌ URL ${url} の処理中にエラーが発生しました: ${(error as Error).message}`);
    return null;
  }
}

/**
 * 複数のURLを処理する
 * @param urls 処理するURLの配列
 * @param outputDir 出力ディレクトリ
 * @param summaryLength 要約の長さ
 * @returns 処理結果の配列
 */
export async function processUrls(urls: string[], outputDir: string, summaryLength: string): Promise<ProcessResult[]> {
  console.log(`📋 処理するURL一覧:`);
  urls.forEach((url, index) => {
    console.log(`  ${index + 1}. ${url}`);
  });
  console.log('');
  
  const results: ProcessResult[] = [];
  
  for (let i = 0; i < urls.length; i++) {
    console.log(`\n🔄 URL ${i + 1}/${urls.length} を処理中...`);
    const result = await processUrl(urls[i], outputDir, summaryLength);
    if (result) {
      results.push(result);
    }
  }
  
  return results;
}
