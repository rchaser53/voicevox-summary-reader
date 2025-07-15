const path = require('path');
const fs = require('fs');
const ConfigManager = require('./lib/config-manager');
const VoicevoxAPI = require('./lib/voicevox-api');
const AudioPlayer = require('./lib/audio-player');
const FileUtils = require('./lib/file-utils');
const { processUrls } = require('./lib/website-summarizer-core');

// 設定ファイルのパス
const CONFIG_FILE = path.join(__dirname, 'config.json');

/**
 * メイン関数
 */
async function main() {
  console.log('=== ウェブサイト要約読み上げツール ===');
  
  try {
    // 設定を初期化
    const configManager = new ConfigManager(CONFIG_FILE);
    configManager.loadConfig();
    const config = configManager.getConfig();
    
    // 設定ファイルからウェブサイトURLを取得
    if (!config.websites || !config.websites.urls || !Array.isArray(config.websites.urls) || config.websites.urls.length === 0) {
      console.error('❌ エラー: 設定ファイルに有効なwebsites.urlsが設定されていません');
      console.log('config.jsonに以下のような設定を追加してください:');
      console.log(`
  "websites": {
    "urls": [
      "https://example.com",
      "https://example.org"
    ],
    "output_dir": "website_summaries",
    "summary_length": "medium"
  }`);
      process.exit(1);
    }
    
    const urls = config.websites.urls;
    const outputDir = config.websites.output_dir || 'website_summaries';
    const summaryLength = config.websites.summary_length || 'medium';
    
    console.log(`📋 処理するURL一覧:`);
    urls.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });
    console.log('');
    
    // 複数URLを処理
    const results = await processUrls(urls, outputDir, summaryLength);
    
    if (results.length === 0) {
      console.log('処理に成功したURLがありませんでした。');
      return;
    }
    
    console.log('\n=== 要約が完了しました ===');
    console.log(`${results.length}個のウェブサイトが処理されました。`);
    
    // 音声読み上げを実行
    await generateAndPlayAllAudio(results, configManager);
    
    console.log('\nすべてのウェブサイト要約の読み上げが完了しました。');
  } catch (error) {
    console.error('予期せぬエラーが発生しました:', error);
  }
}

/**
 * 全ての音声ファイルを生成してから順番に再生する
 */
async function generateAndPlayAllAudio(results, configManager) {
  try {
    // VoicevoxAPIとAudioPlayerを初期化
    const voicevoxAPI = new VoicevoxAPI(configManager);
    const audioPlayer = new AudioPlayer(configManager);
    
    console.log('\n=== フェーズ1: 全ての音声ファイルを生成します ===');
    
    const allAudioFiles = [];
    let totalFiles = 0;
    
    // 各ディレクトリ内のファイル数を計算
    for (const result of results) {
      const files = getTextFilesInDirectory(result.outputDir);
      totalFiles += files.length;
    }
    
    console.log(`合計 ${totalFiles} 個の音声ファイルを生成します...\n`);
    
    let currentFileIndex = 0;
    
    // 各ディレクトリを処理
    for (let dirIndex = 0; dirIndex < results.length; dirIndex++) {
      const result = results[dirIndex];
      const dirPath = result.outputDir;
      
      console.log(`\n[ディレクトリ ${dirIndex + 1}/${results.length}] ${path.basename(dirPath)} の音声ファイルを生成中...`);
      
      const textFiles = getTextFilesInDirectory(dirPath);
      const speakerId = configManager.get('speaker.default_id');
      
      for (let fileIndex = 0; fileIndex < textFiles.length; fileIndex++) {
        const fileName = textFiles[fileIndex];
        const filePath = path.join(dirPath, fileName);
        const outputFileName = `website_${dirIndex + 1}_${fileIndex + 1}.wav`;
        
        currentFileIndex++;
        console.log(`[${currentFileIndex}/${totalFiles}] ${fileName} の音声ファイルを生成中...`);
        
        try {
          const fileContent = FileUtils.readTextFile(filePath);
          if (fileContent) {
            const audioFilePath = await voicevoxAPI.generateAudioFile(fileContent, speakerId, outputFileName);
            if (audioFilePath) {
              allAudioFiles.push({
                path: audioFilePath,
                fileName: fileName,
                dirName: path.basename(dirPath)
              });
              console.log(`✅ 音声ファイルを生成しました: ${path.basename(audioFilePath)}`);
            }
          }
        } catch (error) {
          console.error(`❌ ${fileName} の音声生成中にエラーが発生しました:`, error);
          // エラーが発生しても次のファイルに進む
          continue;
        }
      }
    }
    
    if (allAudioFiles.length === 0) {
      console.log('音声ファイルが生成されませんでした。');
      return;
    }
    
    console.log(`\n=== ${allAudioFiles.length}個の音声ファイルが生成されました ===`);
    
    // フェーズ2: すべての音声ファイルを順番に再生
    console.log('\n=== フェーズ2: 音声ファイルの再生を開始します ===');
    
    const audioPaths = allAudioFiles.map(audio => audio.path);
    await audioPlayer.playMultipleFiles(audioPaths);
    
  } catch (error) {
    console.error('音声ファイルの生成・再生中にエラーが発生しました:', error);
  }
}

/**
 * ディレクトリ内のテキストファイル一覧を取得
 */
function getTextFilesInDirectory(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    
    return files.filter(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (!stats.isFile()) return false;
      
      const ext = path.extname(file).toLowerCase();
      return ['.txt', '.md', '.json', '.js', '.ts', '.html', '.css', '.xml', '.csv'].includes(ext);
    }).sort();
    
  } catch (error) {
    console.error(`ディレクトリ ${dirPath} の読み込み中にエラーが発生しました:`, error);
    return [];
  }
}

// プログラムを実行
if (require.main === module) {
  main().catch(error => {
    console.error('予期せぬエラーが発生しました:', error);
  });
}

module.exports = { main };
