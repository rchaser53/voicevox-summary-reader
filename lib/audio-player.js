const player = require('play-sound')(opts = {});

/**
 * 音声再生クラス
 */
class AudioPlayer {
  constructor(config) {
    this.config = config;
    this.autoPlay = config.get('playback.auto_play');
  }

  /**
   * 音声ファイルを再生する
   */
  playAudio(filePath) {
    return new Promise((resolve, reject) => {
      console.log('音声を再生中...');
      player.play(filePath, (err) => {
        if (err) {
          console.error('音声の再生中にエラーが発生しました:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 自動再生が有効な場合に音声を再生する
   */
  async playIfEnabled(filePath) {
    if (this.autoPlay) {
      await this.playAudio(filePath);
    }
  }

  /**
   * 複数の音声ファイルを順番に再生する
   */
  async playMultipleFiles(filePaths) {
    if (!this.autoPlay) {
      console.log('自動再生が無効のため、音声ファイルの再生をスキップします。');
      return;
    }

    console.log(`\n=== 音声ファイルの再生を開始します (${filePaths.length}件) ===`);
    
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const fileName = require('path').basename(filePath);
      
      console.log(`\n[${i + 1}/${filePaths.length}] ${fileName} を再生中...`);
      
      try {
        await this.playAudio(filePath);
        
        // 最後のファイル以外の場合は少し待機
        if (i < filePaths.length - 1) {
          console.log('次のファイルに進みます...\n');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`音声ファイル ${fileName} の再生中にエラーが発生しました:`, error);
        // エラーが発生しても次のファイルに進む
        continue;
      }
    }
    
    console.log('\n=== すべての音声ファイルの再生が完了しました ===');
  }
}

module.exports = AudioPlayer;
