type NormalizedInboundMessageBase = {
  channel: "telegram";
  channelUserId: string;
  chatId: string;
  messageId: string;
  updateId: string;
  timestamp: string;
  receivedAt: string;
};

export type NormalizedTextInboundMessage =
  NormalizedInboundMessageBase & {
    messageType: "text";
    text: string;
    voiceFileId: null;
    voiceFileUniqueId: null;
    voiceDurationSeconds: null;
  };

export type NormalizedVoiceInboundMessage =
  NormalizedInboundMessageBase & {
    messageType: "voice";
    text: null;
    voiceFileId: string;
    voiceFileUniqueId: string | null;
    voiceDurationSeconds: number | null;
  };

export type NormalizedInboundMessage =
  | NormalizedTextInboundMessage
  | NormalizedVoiceInboundMessage;
