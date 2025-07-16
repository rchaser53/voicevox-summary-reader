import * as fs from 'fs';
import { Config } from '../types';

/**
 * 設定管理クラス
 */
export class ConfigManager {
  private configPath: string;
  private defaultConfig: Config;
  private config: Config;

  constructor(configPath: string) {
    this.configPath = configPath;
    this.defaultConfig = {
      api: {
        url: 'http://localhost:50021',
        timeout: 10000
      },
      speaker: {
        default_id: 0,
        name: '四国めたん（ノーマル）'
      },
      output: {
        dir: 'output',
        filename: 'output.wav'
      },
      playback: {
        auto_play: true
      }
    };
    this.config = { ...this.defaultConfig };
  }

  /**
   * 設定ファイルを読み込む
   */
  loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8')) as Partial<Config>;
        this.config = this.mergeConfig(this.defaultConfig, fileConfig);
        console.log('設定ファイルを読み込みました');
      } else {
        console.log('設定ファイルが見つかりません。デフォルト設定を使用します');
        this.saveConfig();
      }
    } catch (error) {
      console.error('設定ファイルの読み込みに失敗しました:', (error as Error).message);
      console.log('デフォルト設定を使用します');
    }
  }

  /**
   * 設定を保存する
   */
  saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      console.log(`設定ファイルを作成しました: ${this.configPath}`);
    } catch (error) {
      console.error('設定ファイルの保存に失敗しました:', (error as Error).message);
    }
  }

  /**
   * 設定を深いマージする
   */
  private mergeConfig(target: any, source: any): Config {
    const result = { ...target };
    
    for (const key in source) {
      const sourceValue = source[key];
      if (sourceValue && typeof sourceValue === 'object' && key in target) {
        result[key] = this.mergeConfig(target[key], sourceValue);
      } else {
        result[key] = sourceValue;
      }
    }
    
    return result;
  }

  /**
   * 設定を取得する
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * 特定の設定値を取得する
   */
  get(path: string): any {
    const keys = path.split('.');
    let value: any = this.config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
}
