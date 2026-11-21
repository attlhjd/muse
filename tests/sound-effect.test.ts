import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const dependencyMocks = vi.hoisted(() => ({
  createAudioPlayer: vi.fn(),
  createAudioResource: vi.fn(),
  entersState: vi.fn(),
}));

vi.mock('@discordjs/voice', () => ({
  AudioPlayerStatus: {Idle: 'idle'},
  VoiceConnectionDisconnectReason: {WebSocketClose: 'websocket-close'},
  VoiceConnectionStatus: {
    Connecting: 'connecting',
    Destroyed: 'destroyed',
    Disconnected: 'disconnected',
    Ready: 'ready',
    Signalling: 'signalling',
  },
  StreamType: {OggOpus: 'ogg/opus', WebmOpus: 'webm-opus'},
  createAudioPlayer: dependencyMocks.createAudioPlayer,
  createAudioResource: dependencyMocks.createAudioResource,
  entersState: dependencyMocks.entersState,
  joinVoiceChannel: vi.fn(),
}));

vi.mock('../src/services/file-cache.js', () => ({
  default: class {},
}));

vi.mock('../src/utils/get-guild-settings.js', () => ({
  getGuildSettings: vi.fn(),
}));

vi.mock('../src/utils/build-embed.js', () => ({
  buildPlayingMessageEmbed: vi.fn(),
}));

import Player, {STATUS} from '../src/services/player.js';

const MEOW_FILE = new URL('../assets/miaous/miaou-01.ogg', import.meta.url).pathname;
const CHANNEL = {id: 'voice-channel-id'} as never;

const makeAudioPlayer = () => ({
  listeners: vi.fn(() => []),
  on: vi.fn(),
  pause: vi.fn(),
  play: vi.fn(),
  stop: vi.fn(),
  unpause: vi.fn(),
});

const makeVoiceConnection = () => ({
  destroy: vi.fn(),
  on: vi.fn(),
  state: {status: 'ready'},
  subscribe: vi.fn(),
});

const getPrivateState = (player: Player) => player as unknown as {
  audioPlayer: ReturnType<typeof makeAudioPlayer> | null;
  playPositionInterval: NodeJS.Timeout | undefined;
};

beforeEach(() => {
  vi.clearAllMocks();
  dependencyMocks.createAudioPlayer.mockImplementation(makeAudioPlayer);
  dependencyMocks.createAudioResource.mockImplementation((sourceStream: {destroy(): void}) => {
    sourceStream.destroy();
    return {};
  });
  dependencyMocks.entersState.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Player sound effects', () => {
  it('hands the connection back to the music once the clip ends', async () => {
    const player = new Player({} as never, 'guild-id');
    const voiceConnection = makeVoiceConnection();
    const musicPlayer = makeAudioPlayer();
    player.voiceConnection = voiceConnection as never;
    getPrivateState(player).audioPlayer = musicPlayer;
    player.status = STATUS.PLAYING;
    const connect = vi.spyOn(player, 'connect');

    await player.playSoundEffect(CHANNEL, MEOW_FILE);

    const effectPlayer = dependencyMocks.createAudioPlayer.mock.results[0].value as ReturnType<typeof makeAudioPlayer>;
    expect(connect).not.toHaveBeenCalled();
    expect(voiceConnection.subscribe.mock.calls.map(([subscribed]) => subscribed)).toEqual([effectPlayer, musicPlayer]);
    expect(effectPlayer.stop).toHaveBeenCalledWith(true);
    expect(voiceConnection.destroy).not.toHaveBeenCalled();
    expect(getPrivateState(player).playPositionInterval).toBeDefined();
    clearInterval(getPrivateState(player).playPositionInterval);
  });

  it('joins for the clip and leaves afterwards when nothing is queued', async () => {
    const player = new Player({} as never, 'guild-id');
    const voiceConnection = makeVoiceConnection();
    vi.spyOn(player, 'connect').mockImplementation(async () => {
      player.voiceConnection = voiceConnection as never;
    });

    await player.playSoundEffect(CHANNEL, MEOW_FILE);

    expect(player.connect).toHaveBeenCalledWith(CHANNEL);
    expect(voiceConnection.subscribe).toHaveBeenCalledTimes(1);
    expect(voiceConnection.destroy).toHaveBeenCalledTimes(1);
    expect(player.voiceConnection).toBeNull();
  });

  it('refuses a second clip while one is playing', async () => {
    const player = new Player({} as never, 'guild-id');
    player.voiceConnection = makeVoiceConnection() as never;
    let finishClip!: () => void;
    dependencyMocks.entersState
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(new Promise<void>(resolve => {
        finishClip = resolve;
      }));

    const first = player.playSoundEffect(CHANNEL, MEOW_FILE);
    await vi.waitFor(() => expect(finishClip).toBeDefined());
    await expect(player.playSoundEffect(CHANNEL, MEOW_FILE)).rejects.toThrow('je miaule déjà');

    finishClip();
    await first;
    await expect(player.playSoundEffect(CHANNEL, MEOW_FILE)).resolves.toBeUndefined();
  });
});
