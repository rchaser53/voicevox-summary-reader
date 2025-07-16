export interface Config {
  api: {
    url: string;
    timeout: number;
  };
  speaker: {
    default_id: number;
    name: string;
  };
  output: {
    dir: string;
    filename: string;
  };
  playback: {
    auto_play: boolean;
  };
}

export interface Speaker {
  id: number;
  name: string;
}

export interface AudioPlayerOptions {
  player?: string;
}
