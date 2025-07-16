import * as fs from 'fs';

/**
 * ファイル操作ユーティリティクラス
 */
export class FileUtils {
  /**
   * ファイルからテキストを読み込む
   */
  static readTextFile(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error(`ファイルの読み込みに失敗しました: ${filePath}`);
      console.error((error as Error).message);
      return null;
    }
  }

  /**
   * ディレクトリが存在しない場合は作成する
   */
  static ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * ファイルにテキストを書き込む
   */
  static writeTextFile(filePath: string, content: string): boolean {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    } catch (error) {
      console.error(`ファイルの書き込みに失敗しました: ${filePath}`);
      console.error((error as Error).message);
      return false;
    }
  }
}
