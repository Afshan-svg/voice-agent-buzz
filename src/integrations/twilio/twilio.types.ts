export interface TwilioIncomingCallPayload {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  CallerName?: string;
  FromCity?: string;
  FromState?: string;
  FromCountry?: string;
}

export interface TwilioStatusCallbackPayload {
  CallSid: string;
  CallStatus: string;
  CallDuration?: string;
  Timestamp?: string;
  SequenceNumber?: string;
}

export interface TwilioMediaStreamConnected {
  event: 'connected';
  protocol: string;
  version: string;
}

export interface TwilioMediaStreamStart {
  event: 'start';
  sequenceNumber: string;
  start: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
    customParameters: Record<string, string>;
  };
  streamSid: string;
}

export interface TwilioMediaStreamMedia {
  event: 'media';
  sequenceNumber: string;
  media: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  streamSid: string;
}

export interface TwilioMediaStreamStop {
  event: 'stop';
  sequenceNumber: string;
  stop: {
    accountSid: string;
    callSid: string;
  };
  streamSid: string;
}

export interface TwilioMediaStreamMark {
  event: 'mark';
  sequenceNumber: string;
  mark: {
    name: string;
  };
  streamSid: string;
}

export interface TwilioMediaStreamDtmf {
  event: 'dtmf';
  sequenceNumber: string;
  dtmf: {
    digit: string;
    track: string;
  };
  streamSid: string;
}

export type TwilioMediaStreamMessage =
  | TwilioMediaStreamConnected
  | TwilioMediaStreamStart
  | TwilioMediaStreamMedia
  | TwilioMediaStreamStop
  | TwilioMediaStreamMark
  | TwilioMediaStreamDtmf;

export interface OutboundMediaMessage {
  event: 'media';
  streamSid: string;
  media: {
    payload: string;
  };
}

export interface OutboundMarkMessage {
  event: 'mark';
  streamSid: string;
  mark: {
    name: string;
  };
}

export interface OutboundClearMessage {
  event: 'clear';
  streamSid: string;
}

export type OutboundMediaStreamMessage =
  | OutboundMediaMessage
  | OutboundMarkMessage
  | OutboundClearMessage;

export interface CallSessionData {
  callSid: string;
  streamSid: string;
  callerNumber: string;
  callId: string;
  startedAt: string;
  status: 'connecting' | 'active' | 'ended';
}
