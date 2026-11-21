import {AttachmentBuilder, ChatInputCommandInteraction, GuildMember} from 'discord.js';
import {SlashCommandBuilder} from '@discordjs/builders';
import {readdir} from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';
import {inject, injectable} from 'inversify';
import {TYPES} from '../types.js';
import PlayerManager from '../managers/player.js';
import {getMemberVoiceChannel} from '../utils/channels.js';
import Command from './index.js';

const MEOWS_DIRECTORY = fileURLToPath(new URL('../../assets/miaous/', import.meta.url));
const CAT_IMAGE_URL = 'https://cataas.com/cat';
const CAT_IMAGE_TIMEOUT_MS = 5_000;
const CAT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

let meowFiles: string[] | undefined;

const pickMeow = async (): Promise<string> => {
  meowFiles ??= (await readdir(MEOWS_DIRECTORY)).filter(name => name.endsWith('.ogg'));
  if (meowFiles.length === 0) {
    throw new Error('aucun miaou disponible');
  }

  return path.join(MEOWS_DIRECTORY, meowFiles[Math.floor(Math.random() * meowFiles.length)]);
};

// The meow matters more than the picture, so any failure here just means no image.
const fetchCatImage = async (): Promise<AttachmentBuilder | null> => {
  try {
    const response = await fetch(CAT_IMAGE_URL, {signal: AbortSignal.timeout(CAT_IMAGE_TIMEOUT_MS)});
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.startsWith('image/')) {
      return null;
    }

    const image = Buffer.from(await response.arrayBuffer());
    if (image.byteLength > CAT_IMAGE_MAX_BYTES) {
      return null;
    }

    const extension = contentType.slice('image/'.length).split(';')[0].replace('jpeg', 'jpg');
    return new AttachmentBuilder(image, {name: `chat.${extension}`});
  } catch {
    return null;
  }
};

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('miaou')
    .setDescription('joue un miaou au hasard et montre un chat');

  public requiresVC = true;

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction) {
    const [channel] = getMemberVoiceChannel(interaction.member as GuildMember) ?? [];
    if (!channel) {
      throw new Error('rejoins un salon vocal d\'abord');
    }

    const player = this.playerManager.get(interaction.guild!.id);
    const playingInChannelId = player.voiceConnection?.joinConfig.channelId ?? channel.id;
    const meow = await pickMeow();
    await interaction.deferReply();

    const content = playingInChannelId === channel.id ? '🐱 miaou !' : `🐱 miaou ! (dans <#${playingInChannelId}>)`;
    await Promise.all([
      player.playSoundEffect(channel, meow),
      fetchCatImage().then(async image => interaction.editReply({content, files: image ? [image] : []})),
    ]);
  }
}
