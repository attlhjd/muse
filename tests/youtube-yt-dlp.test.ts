import 'reflect-metadata';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  getYouTubeMetadata: vi.fn(),
}));

vi.mock('../src/services/player.js', () => ({
  MediaSource: {Youtube: 0},
}));

vi.mock('../src/utils/yt-dlp.js', () => ({
  getYouTubeMetadata: mocks.getYouTubeMetadata,
}));

import YoutubeAPI from '../src/services/youtube-api.js';

const makeEntry = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Title ${id}`,
  channel: 'Channel',
  duration: 180,
  live_status: null,
  ...overrides,
});

const makeApi = () => {
  const cache = {wrap: vi.fn(async (fetchValue: () => Promise<unknown>) => fetchValue())};
  return new YoutubeAPI({YOUTUBE_API_KEY: ''} as never, cache as never);
};

beforeEach(() => {
  mocks.getYouTubeMetadata.mockReset();
});

describe('YoutubeAPI without an API key', () => {
  it('searches through yt-dlp and skips results without a duration', async () => {
    mocks.getYouTubeMetadata.mockResolvedValue({
      entries: [makeEntry('upcoming0001', {duration: null}), makeEntry('playable0001')],
    });

    const songs = await makeApi().search('some query', false);

    expect(mocks.getYouTubeMetadata).toHaveBeenCalledWith('ytsearch10:some query', 10);
    expect(songs).toEqual([expect.objectContaining({
      title: 'Title playable0001',
      artist: 'Channel',
      length: 180,
      url: 'playable0001',
      isLive: false,
      thumbnailUrl: 'https://i.ytimg.com/vi/playable0001/mqdefault.jpg',
    })]);
  });

  it('reads chapters from the full metadata of a single video', async () => {
    mocks.getYouTubeMetadata.mockResolvedValue(makeEntry('dQw4w9WgXcQ', {
      duration: 300,
      description: '0:00 Intro\n1:00 Main',
    }));

    const songs = await makeApi().getVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', true);

    expect(mocks.getYouTubeMetadata).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 1);
    expect(songs.map(({title, offset, length}) => ({title, offset, length}))).toEqual([
      {title: 'Intro (Title dQw4w9WgXcQ)', offset: 0, length: 60},
      {title: 'Main (Title dQw4w9WgXcQ)', offset: 60, length: 240},
    ]);
  });

  it('imports a flat playlist up to the limit, skipping private entries', async () => {
    mocks.getYouTubeMetadata.mockResolvedValue({
      id: 'PL123',
      title: 'Playlist',
      entries: [makeEntry('first000001'), makeEntry('private0001', {duration: null}), makeEntry('second00001'), makeEntry('third000001')],
    });

    const songs = await makeApi().getPlaylist('PL123', false, 2);

    expect(mocks.getYouTubeMetadata).toHaveBeenCalledWith('https://www.youtube.com/playlist?list=PL123', 2);
    expect(songs.map(song => song.url)).toEqual(['first000001', 'second00001']);
    expect(songs[0].playlist).toEqual({title: 'Playlist', source: 'PL123'});
  });

  it('never offers the failing video as its own audio fallback', async () => {
    mocks.getYouTubeMetadata.mockResolvedValue({
      entries: [makeEntry('original001', {title: 'Song'})],
    });

    const fallback = await makeApi().findAudioFallback({
      source: 0,
      title: 'Song',
      artist: 'Channel',
      length: 180,
      offset: 0,
      url: 'original001',
      playlist: null,
      isLive: false,
      thumbnailUrl: null,
    } as never);

    expect(fallback).toBeNull();
  });
});
